// Creates an order for one artwork on either payment rail, per the commerce
// build packet. This supersedes create-checkout-session/create-payment-intent,
// which trusted a CLIENT-SUPPLIED price — here the server reads the price from
// art_pieces and the client never says a number.
//
// Flow:
//   POST { artPieceId, rail: "stripe" | "crypto",
//          shipping: { name, line1, line2?, city, state, zip } }
//   -> validates the piece is published, priced, and not sold/held
//   -> lazily cancels any expired pending order on the piece (no cron)
//   -> inserts the order (a partial unique index makes double-selling a
//      database error, not a race)
//   -> stripe: returns a Stripe Checkout URL (30-min expiry)
//   -> crypto: returns treasury address + exact USDC amount to send on Base
//
// Totals: flat US shipping (SHIPPING_FLAT_CENTS, default $65) and NJ sales
// tax 6.625% on subtotal+shipping for NJ addresses only (docs/01 §8). US
// shipping only for now.
//
// Secrets: STRIPE_SECRET_KEY (exists), TREASURY_ADDRESS, SITE_URL.
// Deploy with JWT verification ON (callers are signed-in buyers).

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";
import { verifyPrivyUser } from "../_shared/privyAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const TREASURY_ADDRESS = Deno.env.get("TREASURY_ADDRESS");
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://jga-studio.vercel.app").replace(/\/+$/, "");
const SHIPPING_FLAT_CENTS = Number(Deno.env.get("SHIPPING_FLAT_CENTS") ?? 6500);
const NJ_TAX_RATE = 0.06625;
const HOLD_MINUTES = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
}

function validAddress(a: unknown): a is ShippingAddress {
  if (!a || typeof a !== "object") return false;
  const r = a as Record<string, unknown>;
  return ["name", "line1", "city", "state", "zip"].every(
    (k) => typeof r[k] === "string" && (r[k] as string).trim().length > 0
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Buyer auth: the app signs users in with Privy (see _shared/privyAuth)
    const privyUserId = await verifyPrivyUser(req);
    if (!privyUserId) return jsonResponse({ error: "Sign in to purchase" }, 401);

    // --- Input --------------------------------------------------------------
    const body = await req.json().catch(() => null);
    const artPieceId = Number(body?.artPieceId);
    const rail = body?.rail;
    const shipping = body?.shipping;
    if (!Number.isFinite(artPieceId)) return jsonResponse({ error: "artPieceId required" }, 400);
    if (rail !== "stripe" && rail !== "crypto") return jsonResponse({ error: "rail must be stripe or crypto" }, 400);
    if (!validAddress(shipping)) {
      return jsonResponse({ error: "Complete shipping address required (name, line1, city, state, zip)" }, 400);
    }
    if (rail === "crypto" && !TREASURY_ADDRESS) {
      return jsonResponse({ error: "Crypto payments are not configured yet" }, 503);
    }
    if (rail === "stripe" && !STRIPE_SECRET_KEY) {
      return jsonResponse({ error: "Card payments are not configured yet" }, 503);
    }

    // --- Load the piece; server is the only source of price -----------------
    const { data: piece, error: pieceError } = await supabase
      .from("art_pieces")
      .select("id, title, price_usd, published_at, sold_at, atlas_artwork_id")
      .eq("id", artPieceId)
      .maybeSingle();
    if (pieceError) return jsonResponse({ error: pieceError.message }, 500);
    if (!piece || !piece.published_at || !piece.atlas_artwork_id) {
      return jsonResponse({ error: "This artwork is not available" }, 404);
    }
    if (piece.sold_at) return jsonResponse({ error: "This artwork has been sold" }, 409);
    if (!piece.price_usd || Number(piece.price_usd) <= 0) {
      return jsonResponse({ error: "This artwork is price-on-request — contact the studio" }, 409);
    }

    // --- Lazy hold expiry: clear stale pending orders on this piece ---------
    await supabase
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("art_piece_id", artPieceId)
      .eq("status", "pending_payment")
      .lt("hold_expires_at", new Date().toISOString());

    // --- Totals (integer cents, computed server-side only) ------------------
    const subtotalCents = Math.round(Number(piece.price_usd) * 100);
    const shippingCents = SHIPPING_FLAT_CENTS;
    const isNJ = shipping.state.trim().toUpperCase() === "NJ";
    const taxCents = isNJ ? Math.round((subtotalCents + shippingCents) * NJ_TAX_RATE) : 0;
    const totalCents = subtotalCents + shippingCents + taxCents;

    // --- Create the order; the partial unique index is the race guard -------
    const holdExpires = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: privyUserId,
        art_piece_id: artPieceId,
        rail,
        subtotal_cents: subtotalCents,
        shipping_cents: shippingCents,
        tax_cents: taxCents,
        total_cents: totalCents,
        shipping_address: shipping,
        hold_expires_at: holdExpires,
      })
      .select("id")
      .single();
    if (orderError) {
      if (orderError.code === "23505") {
        return jsonResponse({ error: "Someone is currently purchasing this artwork — try again shortly" }, 409);
      }
      return jsonResponse({ error: orderError.message }, 500);
    }

    // --- Rail-specific payment setup ----------------------------------------
    if (rail === "stripe") {
      const stripe = new Stripe(STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: piece.title,
                description: "Original artwork from JGA Studio (includes shipping" + (taxCents ? " and NJ sales tax" : "") + ")",
              },
              unit_amount: totalCents,
            },
            quantity: 1,
          },
        ],
        client_reference_id: order.id,
        metadata: { order_id: order.id, art_piece_id: String(artPieceId) },
        expires_at: Math.floor(Date.now() / 1000) + HOLD_MINUTES * 60,
        success_url: `${SITE_URL}/checkout/success?order=${order.id}`,
        cancel_url: `${SITE_URL}/checkout/cancelled?order=${order.id}`,
      });

      await supabase.from("payments").insert({
        order_id: order.id,
        rail: "stripe",
        status: "pending",
        amount_cents: totalCents,
        stripe_session_id: session.id,
        stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
      });

      return jsonResponse({ orderId: order.id, rail, url: session.url, totalCents });
    }

    // crypto: USDC has 6 decimals; cents -> micro-USDC is *10^4 (1:1 USD peg).
    const amountUsdc = totalCents * 10_000;
    await supabase.from("payments").insert({
      order_id: order.id,
      rail: "crypto",
      status: "pending",
      amount_usdc: amountUsdc,
    });

    return jsonResponse({
      orderId: order.id,
      rail,
      totalCents,
      usdc: {
        network: "Base",
        token: "USDC",
        to: TREASURY_ADDRESS,
        amount: (totalCents / 100).toFixed(2),
        amountMicro: String(amountUsdc),
        holdExpiresAt: holdExpires,
      },
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

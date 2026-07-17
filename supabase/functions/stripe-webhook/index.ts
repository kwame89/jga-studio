// Stripe webhook receiver for the commerce core (docs/build-packet
// 1-commerce): the ONLY code path that can mark a stripe-rail order paid.
//
// Rules: verify the signature first, insert (source, event id) into
// webhook_events before acting (the unique constraint is the idempotency —
// a replayed event no-ops), then apply the state transition. Out-of-order
// or impossible transitions no-op with a log line rather than erroring.
//
// Events handled:
//   checkout.session.completed  -> payment succeeded; order paid; piece sold
//   checkout.session.expired    -> cancel order if still pending (hold release)
//   charge.refunded             -> order refunded; piece released for sale
//
// Secrets: STRIPE_SECRET_KEY (exists), STRIPE_WEBHOOK_SECRET (from the
// Stripe dashboard's webhook endpoint). Deploy with --no-verify-jwt — the
// Stripe signature is the auth:
//   supabase functions deploy stripe-webhook --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    return jsonResponse({ error: "stripe-webhook is not configured (missing secrets)" }, 503);
  }

  const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return jsonResponse({ error: "Missing stripe-signature" }, 400);

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET,
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (err) {
    return jsonResponse({ error: `Invalid signature: ${err instanceof Error ? err.message : ""}` }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Idempotency: first delivery inserts; replays conflict and no-op.
  const { error: dedupeError } = await supabase
    .from("webhook_events")
    .insert({ source: "stripe", external_id: event.id, payload: { type: event.type } });
  if (dedupeError) {
    if (dedupeError.code === "23505") return jsonResponse({ received: true, duplicate: true });
    return jsonResponse({ error: dedupeError.message }, 500);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id ?? session.client_reference_id;
        if (!orderId) break;

        const { data: order } = await supabase
          .from("orders")
          .select("id, status, art_piece_id")
          .eq("id", orderId)
          .maybeSingle();
        if (!order || order.status !== "pending_payment") {
          console.log(`completed event for order ${orderId} in state ${order?.status ?? "missing"} — no-op`);
          break;
        }

        await supabase
          .from("payments")
          .update({
            status: "succeeded",
            stripe_payment_intent:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
            updated_at: new Date().toISOString(),
          })
          .eq("order_id", orderId)
          .eq("rail", "stripe");
        await supabase
          .from("orders")
          .update({
            status: "paid",
            // Buyers authenticate with Privy (no email in the token), so the
            // receipt email comes from Stripe's own collection at checkout.
            email: session.customer_details?.email ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);
        await supabase
          .from("art_pieces")
          .update({ sold_at: new Date().toISOString() })
          .eq("id", order.art_piece_id);
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id ?? session.client_reference_id;
        if (!orderId) break;
        await supabase
          .from("orders")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", orderId)
          .eq("status", "pending_payment");
        await supabase
          .from("payments")
          .update({ status: "failed", failure_reason: "checkout session expired", updated_at: new Date().toISOString() })
          .eq("order_id", orderId)
          .eq("rail", "stripe")
          .eq("status", "pending");
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntent =
          typeof charge.payment_intent === "string" ? charge.payment_intent : null;
        if (!paymentIntent) break;

        const { data: payment } = await supabase
          .from("payments")
          .select("order_id")
          .eq("stripe_payment_intent", paymentIntent)
          .eq("status", "succeeded")
          .maybeSingle();
        if (!payment) break;

        await supabase
          .from("payments")
          .update({ refund_reference: charge.id, updated_at: new Date().toISOString() })
          .eq("order_id", payment.order_id)
          .eq("stripe_payment_intent", paymentIntent);
        const { data: order } = await supabase
          .from("orders")
          .update({ status: "refunded", updated_at: new Date().toISOString() })
          .eq("id", payment.order_id)
          .in("status", ["paid", "preparing", "refund_pending"])
          .select("art_piece_id")
          .maybeSingle();
        if (order) {
          // Pre-ship refund releases the piece back to available.
          await supabase.from("art_pieces").update({ sold_at: null }).eq("id", order.art_piece_id);
        }
        break;
      }

      default:
        // Unhandled event types are acknowledged and ignored.
        break;
    }

    return jsonResponse({ received: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

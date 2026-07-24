// Stripe webhook receiver for the commerce core (docs/build-packet
// 1-commerce): the ONLY code path that can mark a stripe-rail order paid.
//
// Rules: verify the signature first, insert (source, event id) into
// webhook_events before acting (the unique constraint is the idempotency —
// a replayed event no-ops), then apply the state transition. Out-of-order
// or impossible transitions no-op with a log line rather than erroring.
//
// Events handled:
//   checkout.session.completed                -> paid (sync methods e.g. card);
//                                                async methods: extend hold, wait
//   checkout.session.async_payment_succeeded  -> paid (delayed methods, e.g.
//                                                stablecoins confirming onchain)
//   checkout.session.async_payment_failed     -> cancel order, release hold
//   checkout.session.expired                  -> cancel order if still pending
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

  // The shared "money arrived" path. Reached from checkout.session.completed
  // (synchronous methods like cards, payment_status already "paid") and from
  // checkout.session.async_payment_succeeded (delayed methods — notably
  // stablecoin payments, which confirm onchain after the buyer finishes the
  // Checkout flow).
  async function markSessionPaid(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.order_id ?? session.client_reference_id;
    if (!orderId) return;

    const { data: order } = await supabase
      .from("orders")
      .select("id, status, art_piece_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.status !== "pending_payment") {
      console.log(`paid event for order ${orderId} in state ${order?.status ?? "missing"} — no-op`);
      return;
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
      // Match the session, not the rail: since docs/10 both card and USDC
      // payments are Stripe Checkout sessions (rail records the button the
      // collector chose, "stripe" or "crypto").
      .eq("stripe_session_id", session.id);
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
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Async payment methods (stablecoins confirming onchain, bank debits)
        // complete the session with payment_status "unpaid"; the money arrives
        // later via async_payment_succeeded. Marking paid here would sell the
        // piece before funds exist — and NOT handling the async event at all
        // was the original bug: a USDC payment succeeded on Stripe while the
        // order stayed pending and the work never flipped to sold.
        if (session.payment_status !== "paid") {
          const orderId = session.metadata?.order_id ?? session.client_reference_id;
          console.log(
            `session ${session.id} completed with payment_status=${session.payment_status} — awaiting async payment`
          );
          if (orderId) {
            // Keep the in-flight payment from being reaped: mark the payment
            // row processing and push the hold out so create-order's lazy
            // expiry cannot cancel an order whose funds are confirming.
            await supabase
              .from("payments")
              .update({ status: "processing", updated_at: new Date().toISOString() })
              .eq("stripe_session_id", session.id)
              .eq("status", "pending");
            await supabase
              .from("orders")
              .update({
                hold_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", orderId)
              .eq("status", "pending_payment");
          }
          break;
        }

        await markSessionPaid(session);
        break;
      }

      case "checkout.session.async_payment_succeeded": {
        await markSessionPaid(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id ?? session.client_reference_id;
        if (!orderId) break;
        await supabase
          .from("payments")
          .update({
            status: "failed",
            failure_reason: "async payment failed",
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_session_id", session.id);
        await supabase
          .from("orders")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", orderId)
          .eq("status", "pending_payment");
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
          .eq("stripe_session_id", session.id)
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

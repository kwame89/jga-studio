// Records the tx hash a buyer says pays for their crypto-rail order. Never
// trusts the claim — it only moves the payment to "processing";
// confirm-crypto-payment independently verifies the transfer onchain before
// anything is marked paid (docs/build-packet 1-commerce).
//
// POST { orderId, txHash } — caller must own the order. Deploy with JWT
// verification ON.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) return jsonResponse({ error: "Sign in required" }, 401);

    const body = await req.json().catch(() => null);
    const orderId = body?.orderId;
    const txHash = String(body?.txHash ?? "").trim().toLowerCase();
    if (!orderId || !/^0x[0-9a-f]{64}$/.test(txHash)) {
      return jsonResponse({ error: "orderId and a valid txHash (0x…, 66 chars) are required" }, 400);
    }

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, status, rail")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.user_id !== user.id) return jsonResponse({ error: "Order not found" }, 404);
    if (order.rail !== "crypto") return jsonResponse({ error: "Not a crypto order" }, 400);
    if (order.status !== "pending_payment") {
      return jsonResponse({ error: `Order is ${order.status}` }, 409);
    }

    const { error: updateError } = await supabase
      .from("payments")
      .update({ tx_hash: txHash, status: "processing", updated_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .eq("rail", "crypto")
      .in("status", ["pending", "processing"]);
    if (updateError) {
      if (updateError.code === "23505") {
        return jsonResponse({ error: "That transaction hash is already used by another order" }, 409);
      }
      return jsonResponse({ error: updateError.message }, 500);
    }

    return jsonResponse({ ok: true, status: "processing" });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

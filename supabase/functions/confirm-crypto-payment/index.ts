// Independently verifies a submitted USDC payment onchain and, only then,
// marks the order paid — the crypto-rail counterpart of stripe-webhook's
// checkout.session.completed. The client polls this endpoint after
// submit-crypto-payment; the server never trusts the client's claim.
//
// Verification (docs/build-packet 1-commerce): the receipt must be
// successful, contain a USDC Transfer log to the treasury address with
// value >= the quoted amount, and be >= CONFIRMATIONS blocks deep.
//
// POST { orderId } -> { status: "pending" | "confirmed" | "failed", ... }
//
// Secrets: BASE_RPC_URL (exists), TREASURY_ADDRESS; USDC_ADDRESS optional
// (defaults to canonical Base USDC). Deploy with JWT verification ON.

import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyPrivyUser } from "../_shared/privyAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASE_RPC_URL = Deno.env.get("BASE_RPC_URL");
const TREASURY_ADDRESS = (Deno.env.get("TREASURY_ADDRESS") ?? "").toLowerCase();
const USDC_ADDRESS = (
  Deno.env.get("USDC_ADDRESS") ?? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
).toLowerCase();
const CONFIRMATIONS = Number(Deno.env.get("CONFIRMATIONS") ?? 10);

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

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

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(BASE_RPC_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "RPC error");
  return json.result;
}

function topicToAddress(topic: string): string {
  return ("0x" + topic.slice(-40)).toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!BASE_RPC_URL || !TREASURY_ADDRESS) {
    return jsonResponse({ error: "Crypto confirmation is not configured" }, 503);
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const privyUserId = await verifyPrivyUser(req);
    if (!privyUserId) return jsonResponse({ error: "Sign in required" }, 401);

    const body = await req.json().catch(() => null);
    const orderId = body?.orderId;
    if (!orderId) return jsonResponse({ error: "orderId required" }, 400);

    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id, status, art_piece_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order || order.user_id !== privyUserId) return jsonResponse({ error: "Order not found" }, 404);
    if (order.status === "paid") return jsonResponse({ status: "confirmed" });
    if (order.status !== "pending_payment") {
      return jsonResponse({ status: "failed", reason: `Order is ${order.status}` });
    }

    const { data: payment } = await supabase
      .from("payments")
      .select("id, tx_hash, amount_usdc, status")
      .eq("order_id", orderId)
      .eq("rail", "crypto")
      .maybeSingle();
    if (!payment?.tx_hash) {
      return jsonResponse({ status: "pending", reason: "No transaction submitted yet" });
    }

    // --- Onchain verification ------------------------------------------------
    const receipt = (await rpc("eth_getTransactionReceipt", [payment.tx_hash])) as {
      status?: string;
      blockNumber?: string;
      logs?: { address: string; topics: string[]; data: string }[];
    } | null;

    if (!receipt || !receipt.blockNumber) {
      return jsonResponse({ status: "pending", reason: "Transaction not mined yet" });
    }
    if (receipt.status !== "0x1") {
      await supabase
        .from("payments")
        .update({ status: "failed", failure_reason: "transaction reverted", updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      return jsonResponse({ status: "failed", reason: "Transaction reverted onchain" });
    }

    const transfer = (receipt.logs ?? []).find(
      (log) =>
        log.address.toLowerCase() === USDC_ADDRESS &&
        log.topics?.[0] === TRANSFER_TOPIC &&
        log.topics.length >= 3 &&
        topicToAddress(log.topics[2]) === TREASURY_ADDRESS
    );
    if (!transfer) {
      await supabase
        .from("payments")
        .update({ status: "failed", failure_reason: "no USDC transfer to treasury in tx", updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      return jsonResponse({ status: "failed", reason: "That transaction doesn't pay USDC to the studio treasury" });
    }

    const received = BigInt(transfer.data);
    const quoted = BigInt(payment.amount_usdc ?? 0);
    if (received < quoted) {
      await supabase
        .from("payments")
        .update({
          status: "failed",
          failure_reason: `underpaid: ${received} < ${quoted}`,
          received_usdc: Number(received),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);
      return jsonResponse({ status: "failed", reason: "Amount received is less than the quoted total" });
    }

    const latestBlock = BigInt((await rpc("eth_blockNumber", [])) as string);
    const depth = latestBlock - BigInt(receipt.blockNumber) + 1n;
    if (depth < BigInt(CONFIRMATIONS)) {
      return jsonResponse({
        status: "pending",
        reason: `Waiting for confirmations (${depth}/${CONFIRMATIONS})`,
      });
    }

    // --- Confirmed: same transition the stripe webhook performs -------------
    await supabase
      .from("payments")
      .update({ status: "succeeded", received_usdc: Number(received), updated_at: new Date().toISOString() })
      .eq("id", payment.id);
    await supabase
      .from("orders")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", orderId)
      .eq("status", "pending_payment");
    await supabase
      .from("art_pieces")
      .update({ sold_at: new Date().toISOString() })
      .eq("id", order.art_piece_id);

    return jsonResponse({ status: "confirmed" });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

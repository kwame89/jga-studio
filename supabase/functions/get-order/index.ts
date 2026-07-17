// Returns the caller's own order status. Buyers authenticate with Privy, so
// there is no Supabase JWT for own-row RLS — orders are service-role-only
// and this function is the read path (checkout success page polls it).
//
// POST { orderId } -> { status, art_piece_id, title }
// Deploy with --no-verify-jwt (Privy verification in _shared/privyAuth is
// the auth, same as admin-catalog):
//   supabase functions deploy get-order --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyPrivyUser } from "../_shared/privyAuth.ts";

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
    const privyUserId = await verifyPrivyUser(req);
    if (!privyUserId) return jsonResponse({ error: "Sign in required" }, 401);

    const body = await req.json().catch(() => null);
    const orderId = body?.orderId;
    if (!orderId) return jsonResponse({ error: "orderId required" }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, user_id, status, art_piece_id")
      .eq("id", orderId)
      .maybeSingle();
    if (error) return jsonResponse({ error: error.message }, 500);
    if (!order || order.user_id !== privyUserId) {
      return jsonResponse({ error: "Order not found" }, 404);
    }

    const { data: piece } = await supabase
      .from("art_pieces")
      .select("title")
      .eq("id", order.art_piece_id)
      .maybeSingle();

    return jsonResponse({
      status: order.status,
      art_piece_id: order.art_piece_id,
      title: piece?.title ?? null,
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});

import { PrivyClient } from "npm:@privy-io/node@0.26.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRIVY_APP_ID = Deno.env.get("PRIVY_APP_ID");
const PRIVY_APP_SECRET = Deno.env.get("PRIVY_APP_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request) {
  const header = req.headers.get("Authorization") ?? "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

function safeErrorMessage(message: string) {
  const knownMessages = [
    "Artwork not found",
    "Price must be greater than zero",
    "Set a price greater than zero before publishing",
    "Add an artwork image before publishing",
    "Unsupported catalog action",
  ];
  return knownMessages.find((known) => message.includes(known)) ??
    "The catalog update could not be completed";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    return jsonResponse({ error: "Studio admin authentication is not configured" }, 503);
  }

  const token = getBearerToken(req);
  if (!token) {
    return jsonResponse({ error: "Missing Privy access token" }, 401);
  }

  let actorPrivyUserId: string;
  try {
    const privy = new PrivyClient({
      appId: PRIVY_APP_ID,
      appSecret: PRIVY_APP_SECRET,
    });
    const claims = await privy.utils().auth().verifyAuthToken(token);
    actorPrivyUserId = claims.user_id;
  } catch {
    return jsonResponse({ error: "Invalid or expired Privy access token" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: admin, error: adminError } = await supabase
    .from("studio_admins")
    .select("privy_user_id")
    .eq("privy_user_id", actorPrivyUserId)
    .eq("enabled", true)
    .maybeSingle();

  if (adminError) {
    return jsonResponse({ error: "Could not verify studio admin access" }, 500);
  }
  if (!admin) {
    return jsonResponse({ error: "Studio admin access required" }, 403);
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("art_pieces")
      .select(
        "id, atlas_artwork_id, title, image_url, price_usd, published_at, atlas_synced_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      return jsonResponse({ error: "Could not load the studio catalog" }, 500);
    }
    return jsonResponse({ is_admin: true, items: data ?? [] });
  }

  const body = await req.json().catch(() => null);
  const artPieceId = Number(body?.artPieceId);
  const action = typeof body?.action === "string" ? body.action : "";

  if (!Number.isSafeInteger(artPieceId) || artPieceId <= 0) {
    return jsonResponse({ error: "A valid artwork id is required" }, 400);
  }
  if (!["set_price", "publish", "unpublish"].includes(action)) {
    return jsonResponse({ error: "Unsupported catalog action" }, 400);
  }

  let priceUsd: number | null = null;
  if (body?.priceUsd !== null && body?.priceUsd !== undefined && body?.priceUsd !== "") {
    priceUsd = Number(body.priceUsd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      return jsonResponse({ error: "Price must be greater than zero" }, 400);
    }
  }

  const { data, error } = await supabase.rpc("admin_update_catalog_item", {
    p_actor_privy_user_id: actorPrivyUserId,
    p_art_piece_id: artPieceId,
    p_action: action,
    p_price_usd: priceUsd,
  });

  if (error) {
    return jsonResponse({ error: safeErrorMessage(error.message) }, 400);
  }

  return jsonResponse({ item: data });
});

import { PrivyClient } from "npm:@privy-io/node@0.26.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PRIVY_APP_ID = Deno.env.get("PRIVY_APP_ID");
const PRIVY_APP_SECRET = Deno.env.get("PRIVY_APP_SECRET");

interface CatalogItemRow {
  id: number;
  image_url: string | null;
  published_at: string | null;
}

interface CatalogCollectionRow {
  id: string;
  cover_art_piece_id: number | null;
  [key: string]: unknown;
}

interface CatalogMembershipRow {
  collection_id: string;
  art_piece_id: number;
  display_order: number;
}

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

function getPrivyUserIdCandidates(userId: string) {
  const normalized = userId.trim();
  const unprefixed = normalized.replace(/^did:privy:/i, "");

  return [...new Set([
    normalized,
    unprefixed,
    unprefixed ? `did:privy:${unprefixed}` : "",
  ])].filter(Boolean);
}

function safeErrorMessage(message: string) {
  const knownMessages = [
    "Artwork not found",
    "Price must be greater than zero",
    "Set a price greater than zero before publishing",
    "Add an artwork image before publishing",
    "Studio collection not found",
    "Publish at least one collection artwork first",
    "Unsupported collection action",
    "Unsupported catalog action",
  ];
  return knownMessages.find((known) => message.includes(known)) ??
    "The catalog update could not be completed";
}

Deno.serve(async (req: Request) => {
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
    const claims = await privy.utils().auth().verifyAccessToken(token);
    actorPrivyUserId = claims.userId;
  } catch {
    return jsonResponse({ error: "Invalid or expired Privy access token" }, 401);
  }

  const privyUserIdCandidates = getPrivyUserIdCandidates(actorPrivyUserId);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: admin, error: adminError } = await supabase
    .from("studio_admins")
    .select("privy_user_id")
    .in("privy_user_id", privyUserIdCandidates)
    .eq("enabled", true)
    .maybeSingle();

  if (adminError) {
    return jsonResponse({ error: "Could not verify studio admin access" }, 500);
  }
  if (!admin) {
    console.warn("Studio admin access denied", {
      actorPrivyUserId,
      checkedUserIds: privyUserIdCandidates,
    });
    return jsonResponse({ error: "Studio admin access required" }, 403);
  }

  if (req.method === "GET") {
    const [
      { data: items, error: itemsError },
      { data: collections, error: collectionsError },
      { data: memberships, error: membershipsError },
    ] = await Promise.all([
      supabase
        .from("art_pieces")
        .select(
          "id, atlas_artwork_id, title, image_url, price_usd, published_at, atlas_synced_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("studio_collections")
        .select(
          "id, atlas_collection_id, title, description, start_year, end_year, cover_art_piece_id, published_at, atlas_synced_at",
        )
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false }),
      supabase
        .from("studio_collection_artworks")
        .select("collection_id, art_piece_id, display_order"),
    ]);

    if (itemsError || collectionsError || membershipsError) {
      return jsonResponse({ error: "Could not load the studio catalog" }, 500);
    }

    const itemRows = (items ?? []) as CatalogItemRow[];
    const membershipRows = (memberships ?? []) as CatalogMembershipRow[];
    const piecesById = new Map(
      itemRows.map((item) => [item.id, item])
    );
    const collectionRows = ((collections ?? []) as CatalogCollectionRow[]).map((collection) => {
      const collectionMemberships = membershipRows.filter(
        (membership) => membership.collection_id === collection.id
      ).sort((a, b) => a.display_order - b.display_order);
      return {
        ...collection,
        artwork_count: collectionMemberships.length,
        artwork_ids: collectionMemberships.map(
          (membership) => membership.art_piece_id
        ),
        published_artwork_count: collectionMemberships.filter(
          (membership) => Boolean(piecesById.get(membership.art_piece_id)?.published_at)
        ).length,
        cover_image_url: collection.cover_art_piece_id
          ? piecesById.get(collection.cover_art_piece_id)?.image_url ?? null
          : null,
      };
    });

    return jsonResponse({
      is_admin: true,
      items: itemRows,
      collections: collectionRows,
    });
  }

  const body = await req.json().catch(() => null);
  const entityType = body?.entityType === "collection" ? "collection" : "artwork";
  const action = typeof body?.action === "string" ? body.action : "";

  if (entityType === "collection") {
    const collectionId =
      typeof body?.collectionId === "string" ? body.collectionId : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(collectionId)) {
      return jsonResponse({ error: "A valid collection id is required" }, 400);
    }
    if (!["publish", "unpublish"].includes(action)) {
      return jsonResponse({ error: "Unsupported collection action" }, 400);
    }

    const { data, error } = await supabase.rpc(
      "admin_update_studio_collection",
      {
        p_actor_privy_user_id: actorPrivyUserId,
        p_collection_id: collectionId,
        p_action: action,
      }
    );
    if (error) {
      return jsonResponse({ error: safeErrorMessage(error.message) }, 400);
    }
    return jsonResponse({ collection: data });
  }

  const artPieceId = Number(body?.artPieceId);
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

// Read and update the caller's own collector profile (display name + avatar).
//
// Collectors authenticate with Privy, so there is no Supabase JWT for own-row
// RLS — collector_profiles is service-role-only and this function is the sole
// read/write path, same arrangement as get-order.
//
// POST { action: "get" }
//   -> { profile: { display_name, avatar_url, wishlist } | null }
// POST { action: "save", displayName?, avatarBase64?, avatarMime?, wishlist? }
//   -> { profile: { display_name, avatar_url, wishlist } }
//
// The avatar arrives base64-encoded rather than via a signed upload URL: the
// client already downscales to 512px, so payloads are ~100-200KB, and one
// round trip is simpler than mint-url → upload → confirm. The object path is
// derived from the verified DID, never from client input, so a caller cannot
// write over someone else's avatar.
//
// Deploy with --no-verify-jwt (Privy verification below is the auth):
//   supabase functions deploy collector-profile --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyPrivyUser } from "../_shared/privyAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 3 * 1024 * 1024;
const MAX_NAME_LENGTH = 60;
// A saved-works list is a browsing aid, not a catalogue. The bound exists so a
// malformed or malicious client cannot push an unbounded blob into the row.
const MAX_WISHLIST_ITEMS = 500;
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Filesystem-safe slug of a DID, so it can be an object path segment. */
function didToPathSegment(did: string) {
  return did.replace(/[^a-zA-Z0-9]/g, "_");
}

function decodeBase64(input: string): Uint8Array {
  // Accept a bare payload or a full `data:image/png;base64,...` URL.
  const comma = input.indexOf(",");
  const payload = input.startsWith("data:") && comma !== -1
    ? input.slice(comma + 1)
    : input;
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const privyUserId = await verifyPrivyUser(req);
    if (!privyUserId) return jsonResponse({ error: "Sign in required" }, 401);

    const body = await req.json().catch(() => null);
    const action = body?.action ?? "get";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "get") {
      const { data, error } = await supabase
        .from("collector_profiles")
        .select("display_name, avatar_url, wishlist")
        .eq("privy_did", privyUserId)
        .maybeSingle();
      if (error) throw error;
      return jsonResponse({ profile: data ?? null });
    }

    if (action !== "save") {
      return jsonResponse({ error: "Unknown action" }, 400);
    }

    const updates: Record<string, unknown> = { privy_did: privyUserId };

    // --- display name ---
    if (body?.displayName !== undefined) {
      const raw = body.displayName;
      if (raw === null || (typeof raw === "string" && raw.trim() === "")) {
        updates.display_name = null;
      } else if (typeof raw !== "string") {
        return jsonResponse({ error: "displayName must be a string" }, 400);
      } else {
        const trimmed = raw.trim();
        if (trimmed.length > MAX_NAME_LENGTH) {
          return jsonResponse(
            { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` },
            400,
          );
        }
        updates.display_name = trimmed;
      }
    }

    // --- avatar ---
    if (body?.avatarBase64) {
      const mime = String(body.avatarMime ?? "image/jpeg");
      const ext = ALLOWED_MIME[mime];
      if (!ext) {
        return jsonResponse(
          { error: "Avatar must be a JPEG, PNG, or WebP image" },
          400,
        );
      }

      let bytes: Uint8Array;
      try {
        bytes = decodeBase64(String(body.avatarBase64));
      } catch {
        return jsonResponse({ error: "Avatar image could not be decoded" }, 400);
      }
      if (bytes.byteLength === 0) {
        return jsonResponse({ error: "Avatar image was empty" }, 400);
      }
      if (bytes.byteLength > MAX_AVATAR_BYTES) {
        return jsonResponse({ error: "Avatar image is too large" }, 413);
      }

      // Path is derived from the verified DID — never from client input — so a
      // caller can only ever overwrite their own object. The timestamp busts
      // any CDN/browser cache of the previous avatar.
      const path = `${didToPathSegment(privyUserId)}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, bytes, { contentType: mime, upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(path);
      updates.avatar_url = publicUrl.publicUrl;
    }

    // --- wishlist ---
    // Written whole rather than diffed: it is a small set, the client always
    // holds the full list, and last-write-wins is the right semantic for a
    // collector editing their own saves on one device at a time.
    if (body?.wishlist !== undefined) {
      const raw = body.wishlist;
      if (!Array.isArray(raw)) {
        return jsonResponse({ error: "wishlist must be an array" }, 400);
      }
      if (raw.length > MAX_WISHLIST_ITEMS) {
        return jsonResponse(
          { error: `A wishlist is limited to ${MAX_WISHLIST_ITEMS} works` },
          413,
        );
      }

      // Normalise rather than trusting the client's shape — Profile iterates
      // these fields directly and a missing id would break rendering.
      const cleaned = [];
      const seen = new Set<number>();
      for (const entry of raw) {
        const id = Number((entry as Record<string, unknown>)?.id);
        if (!Number.isFinite(id) || seen.has(id)) continue;
        seen.add(id);
        const item = entry as Record<string, unknown>;
        cleaned.push({
          id,
          title: String(item.title ?? "Untitled").slice(0, 300),
          image_url: String(item.image_url ?? "").slice(0, 2000),
          price_usd: Number(item.price_usd ?? 0) || 0,
        });
      }
      updates.wishlist = cleaned;
    }

    if (Object.keys(updates).length === 1) {
      return jsonResponse({ error: "Nothing to update" }, 400);
    }

    const { data, error } = await supabase
      .from("collector_profiles")
      .upsert(updates, { onConflict: "privy_did" })
      .select("display_name, avatar_url, wishlist")
      .single();
    if (error) throw error;

    return jsonResponse({ profile: data });
  } catch (error) {
    console.error("collector-profile error", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});

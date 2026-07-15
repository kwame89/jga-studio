// Receives artwork identity records pushed from Archive Atlas and upserts
// them into art_pieces + art_images. Spec: docs/09-archive-atlas-integration.md.
//
// Hard rules (docs/09 §2–3):
//  - Service-to-service auth only: HMAC-SHA256 over `${timestamp}.${body}`
//    with a shared secret. No user tokens. Replays older than 5 minutes are
//    rejected.
//  - Single-artist guard: every item's root_artist_id must equal the
//    ATLAS_ROOT_ARTIST_ID secret, or the item is rejected.
//  - Identity fields only. This function NEVER writes price_usd, status,
//    collection_type, or any commerce/auction column. New artworks land
//    unpriced; Jay prices and publishes them in the JGA admin.
//  - Images are COPIED into our own 'artwork' bucket (no hotlinking) and
//    diffed by content hash on re-push. Uploads under 2000 px on the long
//    edge are rejected per the quality gate (docs/08 §5); formats whose
//    dimensions we can't parse are accepted with a note rather than blocked.
//  - Every item writes an admin_audit_log row (actor null = system).
//
// Function secrets to set:
//   ATLAS_SHARED_SECRET   — same value as JGA_PUSH_SHARED_SECRET on the Atlas side
//   ATLAS_ROOT_ARTIST_ID  — Jay's Atlas profile uuid; the only accepted root artist
// Deploy with --no-verify-jwt (the HMAC is the auth):
//   supabase functions deploy atlas-import --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ATLAS_SHARED_SECRET = Deno.env.get("ATLAS_SHARED_SECRET");
const ATLAS_ROOT_ARTIST_ID = Deno.env.get("ATLAS_ROOT_ARTIST_ID");

const MAX_ARTWORKS = 20;
const MAX_IMAGES_PER_ARTWORK = 12;
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const MIN_LONG_EDGE_PX = 2000;
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
const BUCKET = "artwork";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- Image dimension sniffing (JPEG/PNG/WebP headers, no decode) -----------

type Dimensions = { width: number; height: number } | null;

function pngDimensions(b: Uint8Array): Dimensions {
  if (b.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47];
  if (!sig.every((v, i) => b[i] === v)) return null;
  const view = new DataView(b.buffer, b.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(b: Uint8Array): Dimensions {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const view = new DataView(b.buffer, b.byteOffset);
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1];
    // SOF0–SOF15 carry dimensions, except DHT (C4), JPG (C8), DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
    }
    const length = view.getUint16(i + 2);
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

function webpDimensions(b: Uint8Array): Dimensions {
  if (b.length < 30) return null;
  const ascii = (start: number, len: number) => String.fromCharCode(...b.slice(start, start + len));
  if (ascii(0, 4) !== "RIFF" || ascii(8, 4) !== "WEBP") return null;
  const chunk = ascii(12, 4);
  const view = new DataView(b.buffer, b.byteOffset);
  if (chunk === "VP8X") {
    const width = 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    const height = 1 + (b[27] | (b[28] << 8) | (b[29] << 16));
    return { width, height };
  }
  if (chunk === "VP8 ") {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function imageDimensions(bytes: Uint8Array, contentType: string): Dimensions {
  if (contentType.includes("png")) return pngDimensions(bytes);
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return jpegDimensions(bytes);
  if (contentType.includes("webp")) return webpDimensions(bytes);
  return null;
}

function extensionFor(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

// ---------------------------------------------------------------------------

interface PushedImage {
  url: string;
  is_primary: boolean;
  sort_order: number;
  alt_text: string | null;
}

interface PushedArtwork {
  atlas_artwork_id: string;
  root_artist_id: string;
  title: string;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  edition_number: number | null;
  edition_total: number | null;
  description: string | null;
  tags: string[];
  subject_matter: string | null;
  provenance_url: string;
  images: PushedImage[];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!ATLAS_SHARED_SECRET || !ATLAS_ROOT_ARTIST_ID) {
    return jsonResponse({ error: "atlas-import is not configured (missing function secrets)" }, 503);
  }

  // --- HMAC + replay-window verification, before touching the payload ------
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-atlas-timestamp") ?? "";
  const signature = req.headers.get("x-atlas-signature") ?? "";
  const ts = Number(timestamp);
  if (!timestamp || !signature || !Number.isFinite(ts)) {
    return jsonResponse({ error: "Missing signature headers" }, 401);
  }
  if (Math.abs(Date.now() - ts) > TIMESTAMP_TOLERANCE_MS) {
    return jsonResponse({ error: "Stale timestamp" }, 401);
  }
  const expected = await hmacSha256Hex(ATLAS_SHARED_SECRET, `${timestamp}.${rawBody}`);
  if (!constantTimeEqual(expected, signature.toLowerCase())) {
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  let artworks: PushedArtwork[];
  try {
    const parsed = JSON.parse(rawBody);
    artworks = parsed?.artworks;
    if (!Array.isArray(artworks) || artworks.length === 0) throw new Error();
    if (artworks.length > MAX_ARTWORKS) {
      return jsonResponse({ error: `At most ${MAX_ARTWORKS} artworks per push` }, 400);
    }
  } catch {
    return jsonResponse({ error: "Body must be { artworks: [...] }" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const results = [];

  for (const item of artworks) {
    try {
      results.push(await importOne(supabase, item));
    } catch (err) {
      results.push({
        atlas_artwork_id: item?.atlas_artwork_id ?? null,
        status: "rejected" as const,
        reason: err instanceof Error ? err.message : "Unexpected error",
      });
    }
  }
  return jsonResponse({ results });
});

// deno-lint-ignore no-explicit-any
async function importOne(supabase: any, item: PushedArtwork) {
  if (!item?.atlas_artwork_id || !item?.title) {
    throw new Error("atlas_artwork_id and title are required");
  }
  if (item.root_artist_id !== ATLAS_ROOT_ARTIST_ID) {
    await audit(supabase, "atlas.import.denied", item.atlas_artwork_id, null, {
      reason: "root artist not allowed",
      root_artist_id: item.root_artist_id,
    }, true);
    return {
      atlas_artwork_id: item.atlas_artwork_id,
      status: "rejected" as const,
      reason: "This JGA Studio only accepts artworks from its configured Atlas artist profile",
    };
  }

  // Atlas's structured dimensions arrive pre-formatted; edition info is
  // carried in description-adjacent identity fields v1 doesn't model, so it
  // rides along in the description block if present.
  const editionSuffix =
    item.edition_number && item.edition_total
      ? `\n\nEdition ${item.edition_number} of ${item.edition_total}.`
      : "";
  const identityFields = {
    title: item.title,
    medium: item.medium,
    dimensions: item.dimensions,
    year: item.year,
    description: item.description ? `${item.description}${editionSuffix}` : item.description,
    tags: Array.isArray(item.tags) ? item.tags : [],
    provenance_url: item.provenance_url,
    atlas_synced_at: new Date().toISOString(),
  };

  const { data: existing, error: findError } = await supabase
    .from("art_pieces")
    .select("id, title")
    .eq("atlas_artwork_id", item.atlas_artwork_id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  let pieceId: number;
  let action: "created" | "updated";
  if (existing) {
    const { error } = await supabase.from("art_pieces").update(identityFields).eq("id", existing.id);
    if (error) throw new Error(error.message);
    pieceId = existing.id;
    action = "updated";
  } else {
    // New pieces land unpriced and unpublished-by-default: no price_usd, no
    // status/collection_type — commerce fields are set in the JGA admin.
    const { data: inserted, error } = await supabase
      .from("art_pieces")
      .insert({ ...identityFields, atlas_artwork_id: item.atlas_artwork_id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    pieceId = inserted.id;
    action = "created";
  }

  const imageResults = await syncImages(supabase, pieceId, item);

  await audit(supabase, "atlas.import", item.atlas_artwork_id, pieceId, {
    action,
    fields: Object.keys(identityFields),
    images: imageResults,
  }, false);

  return { atlas_artwork_id: item.atlas_artwork_id, status: action, images: imageResults };
}

// deno-lint-ignore no-explicit-any
async function syncImages(supabase: any, pieceId: number, item: PushedArtwork) {
  const manifest = (item.images ?? []).slice(0, MAX_IMAGES_PER_ARTWORK);
  const results: { source_url: string; status: "copied" | "unchanged" | "rejected"; reason?: string }[] = [];

  const { data: existingRows } = await supabase
    .from("art_images")
    .select("id, content_hash, storage_path, is_primary, sort_order")
    .eq("art_piece_id", pieceId);
  const byHash = new Map((existingRows ?? []).map((r: { content_hash: string }) => [r.content_hash, r]));
  const keptHashes = new Set<string>();
  let primaryPublicUrl: string | null = null;

  for (const image of manifest) {
    try {
      const response = await fetch(image.url);
      if (!response.ok) throw new Error(`fetch failed (${response.status})`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!/image\/(jpeg|jpg|png|webp)/i.test(contentType)) {
        throw new Error(`unsupported content type: ${contentType || "unknown"}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image exceeds 25 MB");

      // Quality gate (docs/08 §5): parseable images below 2000 px on the
      // long edge are rejected; unparseable ones pass with a note.
      const dims = imageDimensions(bytes, contentType);
      if (dims && Math.max(dims.width, dims.height) < MIN_LONG_EDGE_PX) {
        throw new Error(
          `below quality gate: ${dims.width}×${dims.height}, need ≥${MIN_LONG_EDGE_PX}px on the long edge`
        );
      }

      const hash = await sha256Hex(bytes);
      keptHashes.add(hash);
      const existingRow = byHash.get(hash);
      if (existingRow) {
        await supabase
          .from("art_images")
          .update({ is_primary: image.is_primary, sort_order: image.sort_order, source_url: image.url })
          .eq("id", existingRow.id);
        if (image.is_primary) {
          primaryPublicUrl = publicUrl(supabase, existingRow.storage_path);
        }
        results.push({ source_url: image.url, status: "unchanged" });
        continue;
      }

      const path = `art_pieces/${pieceId}/${hash}.${extensionFor(contentType)}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (uploadError) throw new Error(uploadError.message);

      const { error: insertError } = await supabase.from("art_images").insert({
        art_piece_id: pieceId,
        storage_path: path,
        public_url: publicUrl(supabase, path),
        source_url: image.url,
        content_hash: hash,
        sort_order: image.sort_order,
        is_primary: image.is_primary,
        alt_text: image.alt_text ?? item.title,
      });
      if (insertError) throw new Error(insertError.message);

      if (image.is_primary) primaryPublicUrl = publicUrl(supabase, path);
      results.push({
        source_url: image.url,
        status: "copied",
        ...(dims ? {} : { reason: "dimensions unparseable; accepted without quality check" }),
      });
    } catch (err) {
      results.push({
        source_url: image.url,
        status: "rejected",
        reason: err instanceof Error ? err.message : "unexpected error",
      });
    }
  }

  // Rows whose content is no longer in the Atlas manifest are removed —
  // Atlas is the source of truth for the image set (docs/09 §2).
  const stale = (existingRows ?? []).filter(
    (r: { content_hash: string }) => r.content_hash && !keptHashes.has(r.content_hash)
  );
  for (const row of stale) {
    await supabase.from("art_images").delete().eq("id", row.id);
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
  }

  // v1 compatibility: the app renders art_pieces.image_url, so keep it
  // pointed at the primary image's copy in our bucket.
  if (primaryPublicUrl) {
    await supabase.from("art_pieces").update({ image_url: primaryPublicUrl }).eq("id", pieceId);
  }

  return results;
}

// deno-lint-ignore no-explicit-any
function publicUrl(supabase: any, path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// deno-lint-ignore no-explicit-any
async function audit(supabase: any, action: string, atlasId: string, pieceId: number | null, after: unknown, denied: boolean) {
  await supabase.from("admin_audit_log").insert({
    actor_collector_id: null,
    action,
    entity_type: "art_pieces",
    entity_id: pieceId !== null ? String(pieceId) : atlasId,
    after,
    denied,
  });
}

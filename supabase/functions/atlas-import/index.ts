// Receives artwork and collection identity records pushed from Archive Atlas
// and upserts them into the JGA Studio catalog.
//
// Hard rules (docs/09 §2–3):
//  - Service-to-service auth only: HMAC-SHA256 over `${timestamp}.${body}`
//    with a shared secret. No user tokens. Replays older than 5 minutes are
//    rejected.
//  - Single-artist guard: every item's root_artist_id must equal the
//    ATLAS_ROOT_ARTIST_ID secret, or the item is rejected.
//  - Full artwork mirror (decision 2026-07-17): identity fields + the Atlas
//    artwork value written as price_usd, UNLESS art_pieces.price_overridden
//    is set (admin took manual control of the price in JGA). Never writes
//    published_at/status — the JGA publish gate is retained.
//  - Images are COPIED into our own 'artwork' bucket (no hotlinking) and
//    diffed by content hash on re-push. Uploads under 2000 px on the long
//    edge are rejected per the quality gate (docs/08 §5); formats whose
//    dimensions we can't parse are accepted with a note rather than blocked.
//  - Every item writes an admin_audit_log row (actor null = system).
//
// Function secrets to set:
//   ATLAS_SHARED_SECRET   — same value as JGA_PUSH_SHARED_SECRET on the Atlas side
//   ATLAS_ROOT_ARTIST_ID  — Jay's Atlas profile uuid; the only accepted root artist
// HMAC is the auth, so JWT verification is disabled in supabase/config.toml.
// The flag is repeated here for safe one-off deployments:
//   supabase functions deploy atlas-import --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ATLAS_SHARED_SECRET = Deno.env.get("ATLAS_SHARED_SECRET");
const ATLAS_ROOT_ARTIST_ID = Deno.env.get("ATLAS_ROOT_ARTIST_ID");

const MAX_ARTWORKS = 30;
const MAX_COLLECTIONS = 5;
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

// Fallback dimensions string from structured measurements (inches), used when
// Atlas has no free-text dimensions but the artist entered height/width/depth.
function formatDimensions(
  height: number | null,
  width: number | null,
  depth: number | null
): string | null {
  const parts = [height, width, depth].filter((v): v is number => typeof v === "number" && v > 0);
  if (parts.length < 2) return null;
  return `${parts.join(" × ")} in`;
}

// ---------------------------------------------------------------------------

interface PushedImage {
  url: string;
  is_primary: boolean;
  sort_order: number;
  alt_text: string | null;
}

interface PushedProvenanceEvent {
  id: string;
  type: string;
  label: string;
  occurred_at: string;
  actor_name: string | null;
  from_party_name: string | null;
  to_party_name: string | null;
  price: number | null;
  currency: string | null;
  notes: string | null;
  exhibition_title: string | null;
  exhibition_venue: string | null;
  exhibition_location: string | null;
  exhibition_end_date: string | null;
  condition_rating: string | null;
  proof_kind: "signed" | "corroborated" | "anchored" | "recorded";
  proof_label: string;
  anchor_hash: string | null;
}

interface PushedArtwork {
  atlas_artwork_id: string;
  root_artist_id: string;
  title: string;
  medium: string | null;
  dimensions: string | null;
  height: number | null;
  width: number | null;
  depth: number | null;
  year: number | null;
  is_circa: boolean | null;
  edition_number: number | null;
  edition_total: number | null;
  description: string | null;
  tags: string[];
  art_type: string | null;
  subject_matter: string | null;
  is_signed: boolean | null;
  signature_notes: string | null;
  condition: string | null;
  // Atlas artwork value doubles as the JGA sale price (decision 2026-07-17).
  artwork_value: number | null;
  provenance_url: string;
  provenance_events: PushedProvenanceEvent[];
  images: PushedImage[];
}

interface PushedCollection {
  atlas_collection_id: string;
  root_artist_id: string;
  title: string;
  description: string | null;
  start_year: number | null;
  end_year: number | null;
  cover_artwork_id: string | null;
  artwork_ids: string[];
}

interface ExistingImageRow {
  id: string;
  content_hash: string | null;
  storage_path: string;
  is_primary: boolean;
  sort_order: number;
}

interface PreparedImage {
  storage_path: string;
  public_url: string;
  source_url: string;
  content_hash: string;
  sort_order: number;
  is_primary: boolean;
  alt_text: string;
}

Deno.serve(async (req: Request) => {
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
  let collections: PushedCollection[];
  try {
    const parsed = JSON.parse(rawBody);
    artworks = parsed?.artworks;
    collections = Array.isArray(parsed?.collections) ? parsed.collections : [];
    if (!Array.isArray(artworks) || artworks.length === 0) throw new Error();
    if (artworks.length > MAX_ARTWORKS) {
      return jsonResponse({ error: `At most ${MAX_ARTWORKS} artworks per push` }, 400);
    }
    if (collections.length > MAX_COLLECTIONS) {
      return jsonResponse({ error: `At most ${MAX_COLLECTIONS} collections per push` }, 400);
    }
  } catch {
    return jsonResponse(
      { error: "Body must include { artworks: [...], collections?: [...] }" },
      400
    );
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

  const collectionResults = [];
  for (const collection of collections) {
    try {
      collectionResults.push(await importOneCollection(supabase, collection));
    } catch (err) {
      collectionResults.push({
        atlas_collection_id: collection?.atlas_collection_id ?? null,
        status: "rejected" as const,
        reason: err instanceof Error ? err.message : "Unexpected error",
      });
    }
  }

  return jsonResponse({ results, collection_results: collectionResults });
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

  // Full identity mirror (decision 2026-07-17). Dimensions: prefer Atlas's
  // free-text string; otherwise format from structured height/width/depth so
  // the field is never empty when the artist entered measurements.
  const identityFields = {
    title: item.title,
    medium: item.medium,
    dimensions: item.dimensions ?? formatDimensions(item.height, item.width, item.depth),
    height: item.height,
    width: item.width,
    depth: item.depth,
    year: item.year,
    is_circa: item.is_circa,
    edition_number: item.edition_number,
    edition_total: item.edition_total,
    description: item.description,
    tags: Array.isArray(item.tags) ? item.tags : [],
    art_type: item.art_type,
    subject_matter: item.subject_matter,
    signature_notes: item.signature_notes,
    condition: item.condition,
    provenance_url: item.provenance_url,
    provenance_events: Array.isArray(item.provenance_events)
      ? item.provenance_events.slice(0, 100)
      : [],
    atlas_synced_at: new Date().toISOString(),
  };

  // Atlas value → sale price, unless an admin has overridden it in JGA.
  const atlasPrice =
    typeof item.artwork_value === "number" && item.artwork_value > 0
      ? item.artwork_value
      : null;

  const { data: existing, error: findError } = await supabase
    .from("art_pieces")
    .select("id, title, price_overridden")
    .eq("atlas_artwork_id", item.atlas_artwork_id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  let pieceId: number;
  let action: "created" | "updated";
  if (existing) {
    // Only sync price when the admin hasn't taken manual control of it.
    const update = existing.price_overridden
      ? identityFields
      : { ...identityFields, price_usd: atlasPrice };
    const { error } = await supabase.from("art_pieces").update(update).eq("id", existing.id);
    if (error) throw new Error(error.message);
    pieceId = existing.id;
    action = "updated";
  } else {
    // New pieces are priced from Atlas but stay unpublished until an admin
    // reviews and publishes them in JGA (publish gate is retained).
    const { data: inserted, error } = await supabase
      .from("art_pieces")
      .insert({ ...identityFields, price_usd: atlasPrice, atlas_artwork_id: item.atlas_artwork_id })
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
async function importOneCollection(supabase: any, item: PushedCollection) {
  if (!item?.atlas_collection_id || !item?.title) {
    throw new Error("atlas_collection_id and title are required");
  }
  if (item.root_artist_id !== ATLAS_ROOT_ARTIST_ID) {
    await auditCollection(
      supabase,
      "atlas.collection_import.denied",
      item.atlas_collection_id,
      null,
      {
        reason: "root artist not allowed",
        root_artist_id: item.root_artist_id,
      },
      true
    );
    return {
      atlas_collection_id: item.atlas_collection_id,
      status: "rejected" as const,
      reason: "This JGA Studio only accepts collections from its configured Atlas artist profile",
    };
  }

  const artworkIds = [...new Set(item.artwork_ids ?? [])];
  if (artworkIds.length === 0) {
    throw new Error("A collection must contain at least one artwork");
  }
  if (artworkIds.length !== (item.artwork_ids ?? []).length) {
    throw new Error("A collection cannot contain duplicate artworks");
  }

  const { data: pieces, error: piecesError } = await supabase
    .from("art_pieces")
    .select("id, atlas_artwork_id")
    .in("atlas_artwork_id", artworkIds);
  if (piecesError) throw new Error(piecesError.message);
  if ((pieces ?? []).length !== artworkIds.length) {
    throw new Error("Every collection artwork must be imported before the collection");
  }

  const pieceIdByAtlasId = new Map(
    (pieces ?? []).map((piece: { id: number; atlas_artwork_id: string }) => [
      piece.atlas_artwork_id,
      piece.id,
    ])
  );
  const orderedPieceIds = artworkIds.map((artworkId) => {
    const pieceId = pieceIdByAtlasId.get(artworkId);
    if (!pieceId) throw new Error("Collection artwork import is incomplete");
    return pieceId;
  });
  const coverPieceId =
    (item.cover_artwork_id
      ? pieceIdByAtlasId.get(item.cover_artwork_id)
      : null) ?? orderedPieceIds[0];

  const identityFields = {
    title: item.title.trim(),
    description: item.description ?? null,
    start_year: item.start_year ?? null,
    end_year: item.end_year ?? null,
    atlas_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: findError } = await supabase
    .from("studio_collections")
    .select("id")
    .eq("atlas_collection_id", item.atlas_collection_id)
    .maybeSingle();
  if (findError) throw new Error(findError.message);

  let collectionId: string;
  let action: "created" | "updated";
  if (existing) {
    const { error } = await supabase
      .from("studio_collections")
      .update(identityFields)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    collectionId = existing.id;
    action = "updated";
  } else {
    const { data: inserted, error } = await supabase
      .from("studio_collections")
      .insert({
        ...identityFields,
        atlas_collection_id: item.atlas_collection_id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    collectionId = inserted.id;
    action = "created";
  }

  const { error: manifestError } = await supabase.rpc(
    "apply_atlas_collection_manifest",
    {
      p_collection_id: collectionId,
      p_art_piece_ids: orderedPieceIds,
      p_cover_art_piece_id: coverPieceId,
    }
  );
  if (manifestError) {
    if (action === "created") {
      await supabase
        .from("studio_collections")
        .delete()
        .eq("id", collectionId);
    }
    throw new Error(manifestError.message);
  }

  await auditCollection(
    supabase,
    "atlas.collection_import",
    item.atlas_collection_id,
    collectionId,
    {
      action,
      fields: Object.keys(identityFields),
      artwork_count: orderedPieceIds.length,
    },
    false
  );

  return {
    atlas_collection_id: item.atlas_collection_id,
    status: action,
    artwork_count: orderedPieceIds.length,
  };
}

// deno-lint-ignore no-explicit-any
async function syncImages(supabase: any, pieceId: number, item: PushedArtwork) {
  const manifest = (item.images ?? []).slice(0, MAX_IMAGES_PER_ARTWORK);
  const results: { source_url: string; status: "copied" | "unchanged" | "rejected"; reason?: string }[] = [];

  const { data: existingData, error: existingError } = await supabase
    .from("art_images")
    .select("id, content_hash, storage_path, is_primary, sort_order")
    .eq("art_piece_id", pieceId);
  if (existingError) throw new Error(existingError.message);

  const existingRows = (existingData ?? []) as ExistingImageRow[];
  const byHash = new Map(
    existingRows
      .filter((row) => Boolean(row.content_hash))
      .map((row) => [row.content_hash as string, row])
  );
  const prepared: PreparedImage[] = [];
  const newlyUploadedPaths: string[] = [];

  for (const image of manifest) {
    try {
      if (!image?.url) throw new Error("image URL is required");
      const response = await fetch(image.url);
      if (!response.ok) throw new Error(`fetch failed (${response.status})`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!/image\/(jpeg|jpg|png|webp)/i.test(contentType)) {
        throw new Error(`unsupported content type: ${contentType || "unknown"}`);
      }
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
        throw new Error("image exceeds 25 MB");
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
      if (prepared.some((candidate) => candidate.content_hash === hash)) {
        throw new Error("duplicate image content in manifest");
      }

      const existingRow = byHash.get(hash);
      const path = existingRow?.storage_path ?? `art_pieces/${pieceId}/${hash}.${extensionFor(contentType)}`;

      if (!existingRow) {
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType, upsert: true });
        if (uploadError) throw new Error(uploadError.message);
        newlyUploadedPaths.push(path);
      }

      prepared.push({
        storage_path: path,
        public_url: publicUrl(supabase, path),
        source_url: image.url,
        content_hash: hash,
        sort_order: image.sort_order,
        is_primary: image.is_primary,
        alt_text: image.alt_text ?? item.title,
      });
      results.push({
        source_url: image.url,
        status: existingRow ? "unchanged" : "copied",
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

  // A rejected fetch or quality check must never be interpreted as an Atlas
  // deletion. Leave the current manifest untouched and remove only files this
  // attempt uploaded before the failure was known.
  if (results.some((result) => result.status === "rejected")) {
    if (newlyUploadedPaths.length > 0) {
      const { error: rollbackError } = await supabase.storage.from(BUCKET).remove(newlyUploadedPaths);
      if (rollbackError) console.error("Could not roll back staged Atlas image objects", rollbackError);
    }
    return results.map((result) =>
      result.status === "rejected"
        ? result
        : {
            ...result,
            status: "rejected" as const,
            reason: "manifest not applied because another image was rejected",
          }
    );
  }

  const primaryImages = prepared.filter((image) => image.is_primary);
  if (primaryImages.length > 1) {
    if (newlyUploadedPaths.length > 0) {
      await supabase.storage.from(BUCKET).remove(newlyUploadedPaths);
    }
    return results.map((result) => ({
      ...result,
      status: "rejected" as const,
      reason: "manifest contains more than one primary image",
    }));
  }
  if (prepared.length > 0 && primaryImages.length === 0) {
    prepared[0].is_primary = true;
  }

  const keptHashes = new Set(prepared.map((image) => image.content_hash));
  const stalePaths = existingRows
    .filter((row) => !row.content_hash || !keptHashes.has(row.content_hash))
    .map((row) => row.storage_path);
  const primaryPublicUrl = prepared.find((image) => image.is_primary)?.public_url ?? null;

  const { error: applyError } = await supabase.rpc("apply_atlas_image_manifest", {
    p_art_piece_id: pieceId,
    p_images: prepared,
    p_primary_public_url: primaryPublicUrl,
  });
  if (applyError) {
    if (newlyUploadedPaths.length > 0) {
      await supabase.storage.from(BUCKET).remove(newlyUploadedPaths);
    }
    throw new Error(applyError.message);
  }

  // Database rows and image_url are already committed. Storage cleanup comes
  // last, so a cleanup failure can only leave an orphan, never a broken page.
  if (stalePaths.length > 0) {
    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove(stalePaths);
    if (cleanupError) console.error("Could not remove stale Atlas image objects", cleanupError);
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

// deno-lint-ignore no-explicit-any
async function auditCollection(
  supabase: any,
  action: string,
  atlasId: string,
  collectionId: string | null,
  after: unknown,
  denied: boolean
) {
  await supabase.from("admin_audit_log").insert({
    actor_collector_id: null,
    action,
    entity_type: "studio_collection",
    entity_id: collectionId ?? atlasId,
    after,
    denied,
  });
}

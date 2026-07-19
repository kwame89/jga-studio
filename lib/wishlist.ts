// Saved artworks ("Wishlist").
//
// Two stores, deliberately:
//
//   - AsyncStorage is the working copy. Saving is a browsing gesture that has
//     to work before a collector signs in, and it must feel instant.
//   - collector_profiles.wishlist is the durable copy, so saves follow the
//     collector to another device and survive clearing browser data.
//
// Signed out, local is all there is. On the first read after signing in, a
// local-only list is pushed up once (the common path: browse anonymously, save
// a few works, then sign in) — after that the server is authoritative and the
// local copy is a cache of it. Writes go to local first so the UI never waits
// on the network, then to the server.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { callCommerceFunction } from './commerceApi';

const STORAGE_KEY = 'wishlist';

export type WishlistItem = {
  id: number;
  title: string;
  image_url: string;
  price_usd: number;
};

type ProfilePayload = {
  profile: { wishlist?: WishlistItem[] | null } | null;
};

// --- local ------------------------------------------------------------------

export async function getLocalWishlist(): Promise<WishlistItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WishlistItem[]) : [];
  } catch {
    // A corrupt entry should not break browsing — treat it as empty.
    return [];
  }
}

async function setLocalWishlist(items: WishlistItem[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

// --- server -----------------------------------------------------------------

async function pushWishlist(accessToken: string, items: WishlistItem[]) {
  await callCommerceFunction<ProfilePayload>('collector-profile', accessToken, {
    action: 'save',
    wishlist: items,
  });
}

// --- public API -------------------------------------------------------------

/**
 * The collector's saved works. Pass a Privy access token when signed in.
 *
 * Network failures fall back to the local copy rather than showing an empty
 * wishlist — a transient error should never look like lost saves.
 */
export async function getWishlist(
  accessToken?: string | null,
): Promise<WishlistItem[]> {
  const local = await getLocalWishlist();
  if (!accessToken) return local;

  try {
    const { profile } = await callCommerceFunction<ProfilePayload>(
      'collector-profile',
      accessToken,
      { action: 'get' },
    );
    const remote = profile?.wishlist ?? [];

    // One-time seed: works saved before signing in are carried up rather than
    // silently dropped. Only when the server has nothing, so this cannot
    // resurrect works the collector deliberately removed on another device.
    if (remote.length === 0 && local.length > 0) {
      await pushWishlist(accessToken, local);
      return local;
    }

    await setLocalWishlist(remote);
    return remote;
  } catch {
    return local;
  }
}

export async function isSaved(id: number): Promise<boolean> {
  // Reads the local cache on purpose: this only drives a button's icon, and it
  // should not wait on a round trip before the screen can render.
  const items = await getLocalWishlist();
  return items.some((item) => item.id === id);
}

/** Adds or removes the work. Returns the resulting saved state. */
export async function toggleWishlist(
  item: WishlistItem,
  accessToken?: string | null,
): Promise<boolean> {
  const items = await getLocalWishlist();
  const exists = items.some((saved) => saved.id === item.id);
  const next = exists
    ? items.filter((saved) => saved.id !== item.id)
    : [...items, item];

  await setLocalWishlist(next);

  if (accessToken) {
    try {
      await pushWishlist(accessToken, next);
    } catch {
      // The local write already succeeded, so the collector sees their change.
      // The next getWishlist() with a token reconciles.
    }
  }

  return !exists;
}

export async function removeFromWishlist(
  id: number,
  accessToken?: string | null,
): Promise<WishlistItem[]> {
  const next = (await getLocalWishlist()).filter((item) => item.id !== id);
  await setLocalWishlist(next);

  if (accessToken) {
    try {
      await pushWishlist(accessToken, next);
    } catch {
      // As above — local is already correct; the next read reconciles.
    }
  }

  return next;
}

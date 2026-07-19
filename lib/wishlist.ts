// Saved artworks ("Wishlist"), stored on-device.
//
// Deliberately AsyncStorage rather than Supabase: saving is a browsing gesture
// that must work before a collector signs in, and it is the shape Profile
// already reads. If it ever needs to follow a collector across devices, move it
// to collector_profiles and keep this module as the interface so call sites do
// not change.
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'wishlist';

export type WishlistItem = {
  id: number;
  title: string;
  image_url: string;
  price_usd: number;
};

export async function getWishlist(): Promise<WishlistItem[]> {
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

export async function isSaved(id: number): Promise<boolean> {
  const items = await getWishlist();
  return items.some((item) => item.id === id);
}

/** Adds or removes the work. Returns the resulting saved state. */
export async function toggleWishlist(item: WishlistItem): Promise<boolean> {
  const items = await getWishlist();
  const exists = items.some((saved) => saved.id === item.id);
  const next = exists
    ? items.filter((saved) => saved.id !== item.id)
    : [...items, item];

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return !exists;
}

export async function removeFromWishlist(id: number): Promise<WishlistItem[]> {
  const next = (await getWishlist()).filter((item) => item.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

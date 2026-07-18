// Client for the collector-profile Edge Function (display name + avatar).
//
// collector_profiles is service-role-only — collectors sign in with Privy, so
// there is no Supabase JWT for own-row RLS — which is why reads go through the
// function too rather than straight to PostgREST.
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { callCommerceFunction } from './commerceApi';

export type CollectorProfile = {
  display_name: string | null;
  avatar_url: string | null;
};

export const MAX_DISPLAY_NAME_LENGTH = 60;

/** Longest edge of a stored avatar. Keeps the base64 payload well under 1MB. */
const AVATAR_MAX_DIMENSION = 512;

export async function fetchCollectorProfile(
  accessToken: string,
): Promise<CollectorProfile | null> {
  const { profile } = await callCommerceFunction<{
    profile: CollectorProfile | null;
  }>('collector-profile', accessToken, { action: 'get' });
  return profile;
}

export async function saveCollectorProfile(
  accessToken: string,
  input: { displayName?: string | null; avatarBase64?: string; avatarMime?: string },
): Promise<CollectorProfile> {
  const { profile } = await callCommerceFunction<{ profile: CollectorProfile }>(
    'collector-profile',
    accessToken,
    { action: 'save', ...input },
  );
  return profile;
}

export type PickedAvatar = {
  base64: string;
  mime: string;
  /** Local uri, for optimistic preview before the upload lands. */
  previewUri: string;
};

/**
 * Opens the system picker and returns a square, downscaled avatar.
 *
 * Returns null when the collector cancels — callers should treat that as a
 * no-op, not an error. Throws only if permission is denied.
 */
export async function pickAvatar(): Promise<PickedAvatar | null> {
  // Web has no permission prompt; on native, asking when not needed shows a
  // dialog the collector did not ask for.
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error(
        'JGA Studio needs access to your photos to set a profile picture.',
      );
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true,
    // Downscale before encoding — a full-resolution phone photo base64s to
    // several MB and would be rejected by the function.
    ...(Platform.OS !== 'web'
      ? { videoMaxDuration: 0 }
      : {}),
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  if (!asset.base64) {
    throw new Error('That image could not be read. Try another one.');
  }

  return {
    base64: asset.base64,
    mime: asset.mimeType ?? 'image/jpeg',
    previewUri: asset.uri,
  };
}

export { AVATAR_MAX_DIMENSION };

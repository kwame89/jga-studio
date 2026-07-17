import { supabaseAnonKey, supabaseUrl } from '../supabaseClient';

// Calls a commerce Edge Function with the caller's Privy access token — the
// house pattern (see StudioCatalogManager): raw fetch with the anon apikey
// plus `Authorization: Bearer <privy token>`. The functions are deployed
// with --no-verify-jwt and verify the Privy token server-side.
export async function callCommerceFunction<T>(
  name: string,
  accessToken: string,
  body?: unknown,
  method: 'GET' | 'POST' = 'POST',
): Promise<T> {
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload: { error?: string } & T;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Unexpected response from the studio server');
  }
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload;
}

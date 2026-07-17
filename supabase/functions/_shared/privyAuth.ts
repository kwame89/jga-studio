// Buyer authentication for commerce functions. The app signs users in with
// Privy (not Supabase auth), so these functions verify the Privy access
// token from the Authorization header — the same pattern as admin-catalog.
// Deploy consumers with --no-verify-jwt; this verification IS the auth.

import { PrivyClient } from "npm:@privy-io/node@0.26.0";

const PRIVY_APP_ID = Deno.env.get("PRIVY_APP_ID");
const PRIVY_APP_SECRET = Deno.env.get("PRIVY_APP_SECRET");

/** Returns the verified Privy user id (did:privy:…), or null if unauthenticated. */
export async function verifyPrivyUser(req: Request): Promise<string | null> {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) return null;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const privy = new PrivyClient({ appId: PRIVY_APP_ID, appSecret: PRIVY_APP_SECRET });
    const claims = await privy.utils().auth().verifyAccessToken(token);
    return claims.userId ?? null;
  } catch {
    return null;
  }
}

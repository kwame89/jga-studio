// Buyer/admin authentication for JGA Studio Edge Functions. The app signs
// users in with Privy (not Supabase auth), so these functions verify the
// Privy access token from the Authorization header.
//
// Verification is done OFFLINE against Privy's published per-app JWKS
// (ES256 / EC P-256) using `jose` — no app secret and no SDK auth method,
// which is robust to both a wrong PRIVY_APP_SECRET and SDK version drift.
// The app id is the token's required audience, which also ensures a token
// minted for a different Privy app can't be replayed here.
//
// Deploy consumers with --no-verify-jwt; this verification IS the auth.

import { createRemoteJWKSet, jwtVerify } from "npm:jose@5";

const PRIVY_APP_ID = Deno.env.get("PRIVY_APP_ID");

const JWKS = PRIVY_APP_ID
  ? createRemoteJWKSet(
      new URL(`https://auth.privy.io/api/v1/apps/${PRIVY_APP_ID}/jwks.json`)
    )
  : null;

/** Returns the verified Privy user id (did:privy:…), or null if unauthenticated. */
export async function verifyPrivyUser(req: Request): Promise<string | null> {
  if (!PRIVY_APP_ID || !JWKS) return null;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: "privy.io",
      audience: PRIVY_APP_ID,
    });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

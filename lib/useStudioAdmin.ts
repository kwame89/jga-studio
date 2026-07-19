// Whether the signed-in collector may manage the studio catalog.
//
// There is no cheap way to ask. studio_admins is service-role-only — correctly,
// since the admin list should not be readable with the anon key — so the only
// source of truth is the admin-catalog function, which answers 401/403 for
// everyone else.
//
// Cost note: for a non-admin this is a fast rejection with no payload. For an
// admin it fetches the catalog just to learn "yes". That is not free, but it is
// strictly cheaper than what Profile did before, which was to mount the entire
// 800-line StudioCatalogManager on every signed-in collector's screen purely to
// discover the same answer. If the admin surface grows, give admin-catalog a
// lightweight probe action rather than making this heavier.
import { useEffect, useState } from 'react';
import { supabaseAnonKey, supabaseUrl } from '../supabaseClient';

export function useStudioAdmin(
  getAccessToken: () => Promise<string | null>,
  enabled: boolean,
) {
  const [isAdmin, setIsAdmin] = useState(false);
  /** False until the probe resolves, so callers can avoid flashing UI. */
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setIsAdmin(false);
      setChecked(true);
      return;
    }

    setChecked(false);

    (async () => {
      try {
        const token = await getAccessToken();
        if (cancelled) return;
        if (!token) {
          setIsAdmin(false);
          return;
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/admin-catalog`, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${token}`,
          },
        });
        if (!cancelled) setIsAdmin(response.ok);
      } catch {
        // A network failure is not authorization — fail closed.
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Keyed on sign-in state alone: getAccessToken comes from usePrivy with no
    // stability guarantee, and including it would re-probe on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { isAdmin, checked };
}

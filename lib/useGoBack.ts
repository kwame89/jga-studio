// router.back() is a no-op whenever there is no entry to pop — which on web
// is the common case, not the edge case: a shared link, a new tab, a
// bookmark, or a hard refresh all land on the page with an empty stack, so
// the Back control silently does nothing (observed on /artwork/[id]).
//
// useGoBack returns a handler that pops when there is history and otherwise
// navigates to a sensible parent, so Back always moves the user somewhere.

import { useCallback } from 'react';
import { useRouter } from 'expo-router';

/** @param fallback route to use when there is no history to pop (default: Home tab). */
export function useGoBack(fallback: string = '/(tabs)') {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // replace, not push: the fallback stands in for the entry we never had,
    // so Back from there shouldn't return to this page.
    router.replace(fallback as never);
  }, [router, fallback]);
}

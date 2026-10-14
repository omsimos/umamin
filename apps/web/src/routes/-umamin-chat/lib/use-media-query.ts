import { useCallback, useSyncExternalStore } from "react";

const serverSnapshot = () => false;

export function useMediaQuery(query: string): boolean {
  // Stable subscribe: a fresh function each render would make
  // useSyncExternalStore tear down and re-add the listener on every render.
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    serverSnapshot,
  );
}

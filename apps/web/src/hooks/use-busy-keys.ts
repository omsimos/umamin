import { useCallback, useState } from "react";

/**
 * The rows with an action in flight. A useMutation only remembers its latest
 * call, so `isPending && variables.id === row.id` frees row A's buttons as
 * soon as row B is acted on, while A's request is still running. Add a key in
 * onMutate and remove it in onSettled.
 */
export function useBusyKeys() {
  const [keys, setKeys] = useState<ReadonlySet<string>>(() => new Set());

  const add = useCallback((key: string) => {
    setKeys((current) => new Set(current).add(key));
  }, []);

  const remove = useCallback((key: string) => {
    setKeys((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  }, []);

  const has = useCallback((key: string) => keys.has(key), [keys]);

  return { has, add, remove };
}

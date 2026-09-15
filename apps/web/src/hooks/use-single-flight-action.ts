import { useCallback, useRef } from "react";

type AsyncFn<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

export function useSingleFlightAction<TArgs extends unknown[], TResult>(
  action: AsyncFn<TArgs, TResult>,
) {
  // Collapse only IDENTICAL calls: a second submit with a different payload
  // is a new action, not a retry, and must not resolve with the first one's result.
  const inFlightRef = useRef<{ key: string; promise: Promise<TResult> } | null>(
    null,
  );

  return useCallback(
    (...args: TArgs) => {
      const key = JSON.stringify(args);
      const current = inFlightRef.current;
      if (current && current.key === key) {
        return current.promise;
      }

      const promise = action(...args).finally(() => {
        if (inFlightRef.current?.promise === promise)
          inFlightRef.current = null;
      });

      inFlightRef.current = { key, promise };
      return promise;
    },
    [action],
  );
}

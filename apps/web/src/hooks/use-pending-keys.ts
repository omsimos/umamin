import { type MutationKey, useMutationState } from "@tanstack/react-query";

/**
 * The rows with a mutation in flight under `mutationKey`, read from the
 * mutation cache. A useMutation only remembers its latest call, so
 * `isPending && variables.id === row.id` frees row A's buttons as soon as row
 * B is acted on, while A's request is still running. The cache keeps every
 * call, so this counts them all.
 */
export function usePendingKeys<TVariables>(
  mutationKey: MutationKey,
  toKey: (variables: TVariables) => string,
): ReadonlySet<string> {
  return new Set(
    useMutationState({
      filters: { mutationKey, status: "pending" },
      select: (mutation) => toKey(mutation.state.variables as TVariables),
    }),
  );
}

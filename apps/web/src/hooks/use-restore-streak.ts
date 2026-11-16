import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { restoreStreakAction } from "@/lib/actions";
import { ExpectedError } from "@/lib/expected-error";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { applyStreakUpdate } from "@/lib/query-cache";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import {
  restoresLeft,
  STREAK_MIN_DISPLAY,
  STREAK_RESTORES_PER_MONTH,
  type StreakUpdate,
  streakToast,
} from "@/lib/streak";
import type { CurrentUserResponse } from "@/lib/types";

function cachedCurrentUser(queryClient: QueryClient) {
  return (
    queryClient.getQueryData<CurrentUserResponse>(queryKeys.currentUser())
      ?.user ?? null
  );
}

/**
 * Restores the signed-in user's streak and applies it to the caches. A plain
 * function, not tied to a component, so a toast action still works after the
 * composer that showed it has closed.
 */
export async function restoreStreakNow(queryClient: QueryClient) {
  const user = cachedCurrentUser(queryClient);
  if (!user) return;

  const res = await restoreStreakAction();
  if ("error" in res && res.error) throw new ExpectedError(res.error);
  if (!("streakRestore" in res)) return;

  const restored = res.streakRestore;
  applyStreakUpdate(queryClient, user.username, restored);
  toast.success(`${restored.streak}-day streak restored. See you tomorrow.`);
}

/** The composer's restore button. */
export function useRestoreStreak() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => restoreStreakNow(queryClient),
    onError: (err) => {
      toast.error(err.message || "Couldn't restore your streak.");
    },
  });
}

/** The signed-in user's restore state, read from the current-user cache. */
export function useStreakRestoreState() {
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
  });
  return data?.user ?? null;
}

/**
 * A save's success toast. When the save reset a streak that broke yesterday,
 * the toast says so and offers the restore while one is left this month.
 */
export function showSaveToast(
  queryClient: QueryClient,
  message: string,
  update: StreakUpdate | null,
) {
  const broken = update?.streakBroken ?? 0;
  const user = cachedCurrentUser(queryClient);
  if (!user || broken < STREAK_MIN_DISPLAY) {
    toast.success(streakToast(message, update));
    return;
  }

  if (restoresLeft(user) === 0) {
    toast.success(message, {
      description: `Your ${broken}-day streak ended yesterday. You've used all ${STREAK_RESTORES_PER_MONTH} restores this month.`,
    });
    return;
  }

  toast.success(message, {
    description: `Your ${broken}-day streak ended yesterday.`,
    duration: 10_000,
    action: {
      label: "Restore streak",
      onClick: () => {
        restoreStreakNow(queryClient).catch((err: Error) => {
          toast.error(err.message || "Couldn't restore your streak.");
        });
      },
    },
  });
}

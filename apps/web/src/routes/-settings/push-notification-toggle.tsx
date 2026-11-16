import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@umamin/ui/components/switch";
import { cn } from "@umamin/ui/lib/utils";
import { BellIcon, ZapIcon } from "lucide-react";
import { toast } from "sonner";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { ExpectedError } from "@/lib/expected-error";
import { PUSH_CATEGORY } from "@/lib/push-prefs";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { patchCurrentUser } from "@/lib/query-cache";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import type { CurrentUserResponse } from "@/lib/types";
import {
  type PushState,
  usePushNotifications,
} from "../-shared/use-push-notifications";
import { toggleStreakPushAction } from "./actions";

const COPY: Record<Exclude<PushState, "loading">, string> = {
  unsupported: "Not available in this browser.",
  "ios-install":
    "Add Umamin to your Home Screen first to enable notifications.",
  denied:
    "Notifications are blocked. Re-enable them in your browser or device settings.",
  off: "Get notified about replies, follows, messages, group activity and your streak.",
  on: "Get notified about replies, follows, messages, group activity and your streak.",
};

export function PushNotificationToggle() {
  const { state, enable, disable, isPending } = usePushNotifications();

  const actionable = state === "on" || state === "off";
  const warn =
    state === "denied" || state === "ios-install" || state === "unsupported";

  return (
    <>
      <div className="flex items-center space-x-4 rounded-md border p-4 mt-4">
        <BellIcon className="size-6" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium leading-none">Push Notifications</p>
          <p
            className={cn(
              "text-sm",
              warn ? "text-yellow-600" : "text-muted-foreground",
            )}
          >
            {state === "loading"
              ? "Checking notification status…"
              : COPY[state]}
          </p>
        </div>
        <Switch
          aria-label="Push notifications"
          disabled={isPending || !actionable}
          checked={state === "on"}
          onCheckedChange={(checked) => (checked ? enable() : disable())}
        />
      </div>
      {state === "on" && <StreakPushToggle />}
    </>
  );
}

// Streak reminders are the one push category a user can turn off alone.
function StreakPushToggle() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
  });
  const pushPrefs = data?.user?.pushPrefs ?? 0;
  const toggle = useSingleFlightAction(toggleStreakPushAction);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await toggle();
      if ("error" in res && res.error) throw new ExpectedError(res.error);
      return "pushPrefs" in res ? res.pushPrefs : pushPrefs;
    },
    onSuccess: (next) => {
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (user) => ({ ...user, pushPrefs: next })),
      );
      toast.success(
        next & PUSH_CATEGORY.streak
          ? "Streak reminders are on."
          : "Streak reminders are off.",
      );
    },
    onError: (err) => {
      toast.error(err.message || "Couldn't update this setting.");
    },
  });

  return (
    <div className="flex items-center space-x-4 rounded-md border p-4 mt-2">
      <ZapIcon className="size-6" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium leading-none">Streak reminders</p>
        <p className="text-sm text-muted-foreground">
          A reminder at 8pm when your streak ends at midnight, and the next
          morning when you can restore it.
        </p>
      </div>
      <Switch
        aria-label="Streak reminders"
        disabled={mutation.isPending}
        checked={(pushPrefs & PUSH_CATEGORY.streak) !== 0}
        onCheckedChange={() => mutation.mutate()}
      />
    </div>
  );
}

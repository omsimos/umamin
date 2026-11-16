import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@umamin/ui/components/switch";
import { cn } from "@umamin/ui/lib/utils";
import { BellIcon, ZapIcon } from "lucide-react";
import { toast } from "sonner";
import { ExpectedError } from "@/lib/expected-error";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { patchCurrentUser } from "@/lib/query-cache";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import type { CurrentUserResponse } from "@/lib/types";
import {
  type PushState,
  usePushNotifications,
} from "../-shared/use-push-notifications";
import { setStreakPushAction } from "./actions";

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

// Streak reminders can be turned off on their own while push stays on.
function StreakPushToggle() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
  });
  const enabled = !(data?.user?.streakPushOff ?? false);

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await setStreakPushAction({ enabled: next });
      if ("error" in res && res.error) throw new ExpectedError(res.error);
      return "streakPushOff" in res ? res.streakPushOff : !next;
    },
    onSuccess: (streakPushOff) => {
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (user) => ({ ...user, streakPushOff })),
      );
      toast.success(
        streakPushOff
          ? "Streak reminders are off."
          : "Streak reminders are on.",
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
        checked={enabled}
        onCheckedChange={(checked) => mutation.mutate(checked)}
      />
    </div>
  );
}

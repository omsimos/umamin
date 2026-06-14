"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@umamin/ui/components/switch";
import { cn } from "@umamin/ui/lib/utils";
import { BellIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  registerPushSubscriptionAction,
  unregisterPushSubscriptionAction,
} from "@/app/actions/push";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import {
  getExistingSubscription,
  isIosWebPushBlocked,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser } from "@/lib/query-cache";
import type { CurrentUserResponse } from "@/lib/query-types";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

// Effective state is reconciled from LIVE browser facts on mount, not from the
// stored pushPrefs alone — the device's permission/subscription can diverge
// from the server bit (cleared browser data, revoked permission, new device).
type PushState =
  | "loading"
  | "unsupported"
  | "ios-install"
  | "denied"
  | "off"
  | "on";

const COPY: Record<Exclude<PushState, "loading">, string> = {
  unsupported: "Not available in this browser.",
  "ios-install":
    "Add Umamin to your Home Screen first to enable notifications.",
  denied:
    "Notifications are blocked. Re-enable them in your browser or device settings.",
  off: "Get notified about replies, follows, messages, and group activity.",
  on: "Get notified about replies, follows, messages, and group activity.",
};

export function PushNotificationToggle() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PushState>("loading");

  const register = useSingleFlightAction(registerPushSubscriptionAction);
  const unregister = useSingleFlightAction(unregisterPushSubscriptionAction);

  // Sync the master pushPrefs into the current-user cache (read by /api/me).
  // null = unchanged (a per-device unsubscribe that left other devices on).
  const patchPushPrefs = (pushPrefs: number | null) => {
    if (pushPrefs === null) return;
    queryClient.setQueryData<CurrentUserResponse>(
      queryKeys.currentUser(),
      (current) =>
        patchCurrentUser(current, (user) => ({ ...user, pushPrefs })),
    );
  };

  useEffect(() => {
    let active = true;

    (async () => {
      if (!isPushSupported() || !VAPID_PUBLIC_KEY) {
        if (active) setState("unsupported");
        return;
      }
      if (isIosWebPushBlocked()) {
        if (active) setState("ios-install");
        return;
      }
      if (Notification.permission === "denied") {
        // Self-heal: a denied device can't show notifications, so prune any
        // lingering subscription server-side instead of fanning out to it.
        const sub = await getExistingSubscription();
        if (sub) {
          const { endpoint } = sub;
          await sub.unsubscribe().catch(() => {});
          void unregister({ endpoint });
        }
        if (active) setState("denied");
        return;
      }

      const sub = await getExistingSubscription();
      if (active) setState(sub ? "on" : "off");
    })();

    return () => {
      active = false;
    };
  }, [unregister]);

  const enable = useMutation({
    mutationFn: async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(
          permission === "denied"
            ? "Notifications are blocked. Re-enable them in your browser or device settings."
            : "Notification permission was not granted.",
        );
      }
      const sub = await subscribeToPush(VAPID_PUBLIC_KEY as string);
      const res = await register(sub);
      if ("error" in res) throw new Error(res.error);
      return res.pushPrefs;
    },
    onSuccess: (pushPrefs) => {
      patchPushPrefs(pushPrefs);
      setState("on");
      toast.success("Push notifications enabled.");
    },
    onError: (err: Error) => {
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "denied"
      ) {
        setState("denied");
      }
      toast.error(err.message ?? "Couldn't enable notifications.");
    },
  });

  const disable = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeFromPush();
      if (!endpoint) return null;
      const res = await unregister({ endpoint });
      if ("error" in res) throw new Error(res.error);
      return res.pushPrefs;
    },
    onSuccess: (pushPrefs) => {
      patchPushPrefs(pushPrefs);
      setState("off");
      toast.success("Push notifications disabled.");
    },
    onError: (err: Error) => {
      toast.error(err.message ?? "Couldn't disable notifications.");
    },
  });

  const isPending = enable.isPending || disable.isPending;
  const actionable = state === "on" || state === "off";
  const warn =
    state === "denied" || state === "ios-install" || state === "unsupported";

  return (
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
          {state === "loading" ? "Checking notification status…" : COPY[state]}
        </p>
      </div>
      <Switch
        disabled={isPending || !actionable}
        checked={state === "on"}
        onCheckedChange={(checked) =>
          checked ? enable.mutate() : disable.mutate()
        }
      />
    </div>
  );
}

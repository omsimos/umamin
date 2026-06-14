"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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

// Effective state reconciled from LIVE browser facts on mount, not the stored
// pushPrefs alone — a device's permission/subscription can diverge from the
// server bit (cleared data, revoked permission, new device).
export type PushState =
  | "loading"
  | "unsupported"
  | "ios-install"
  | "denied"
  | "off"
  | "on";

// Shared push enable/disable state machine. Consumed by the Settings toggle and
// the /notifications opt-in prompt so the permission -> subscribe -> register
// flow and its reconciliation live in exactly one place (never forked).
export function usePushNotifications() {
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

  const enableMutation = useMutation({
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

  const disableMutation = useMutation({
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

  return {
    state,
    enable: () => enableMutation.mutate(),
    disable: () => disableMutation.mutate(),
    isPending: enableMutation.isPending || disableMutation.isPending,
  };
}

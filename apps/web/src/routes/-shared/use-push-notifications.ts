import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { type ActionResult, callAction } from "@/lib/api";
import {
  getExistingSubscription,
  isIosWebPushBlocked,
  isPushSupported,
  type SerializedSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser } from "@/lib/query-cache";
import type { CurrentUserResponse } from "@/lib/types";

// Ported from apps/www's hooks/use-push-notifications.ts. The two push actions
// aren't in lib/actions.ts, so they're called directly through `callAction`
// (same `{ pushPrefs } | { error }` envelope). VAPID key moves from
// NEXT_PUBLIC_VAPID_PUBLIC_KEY to VITE_VAPID_PUBLIC_KEY.

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as
  | string
  | undefined;

function registerPushSubscriptionAction(
  input: SerializedSubscription,
): Promise<ActionResult<{ pushPrefs: number }>> {
  return callAction<{ pushPrefs: number }>(
    "registerPushSubscriptionAction",
    input,
  );
}

function unregisterPushSubscriptionAction(input: {
  endpoint: string;
}): Promise<ActionResult<{ pushPrefs: number | null }>> {
  return callAction<{ pushPrefs: number | null }>(
    "unregisterPushSubscriptionAction",
    input,
  );
}

export type PushState =
  | "loading"
  | "unsupported"
  | "ios-install"
  | "denied"
  | "off"
  | "on";

export function usePushNotifications() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<PushState>("loading");

  const register = useSingleFlightAction(registerPushSubscriptionAction);
  const unregister = useSingleFlightAction(unregisterPushSubscriptionAction);

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

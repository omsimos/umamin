import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { type ActionResult, callAction } from "@/lib/api";
import { ExpectedError } from "@/lib/expected-error";
import {
  getExistingSubscription,
  isIosWebPushBlocked,
  isPushSupported,
  type SerializedSubscription,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";
import {
  readPushOwner as readOwner,
  writePushOwner as writeOwner,
} from "@/lib/push-owner";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { patchCurrentUser } from "@/lib/query-cache";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
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

// What the browser alone can tell us. "on" also needs the server side.
type DeviceState =
  | "loading"
  | "unsupported"
  | "ios-install"
  | "denied"
  | "subscribed"
  | "unsubscribed";

async function readDevice(): Promise<DeviceState> {
  if (!isPushSupported() || !VAPID_PUBLIC_KEY) return "unsupported";
  if (isIosWebPushBlocked()) return "ios-install";
  if (Notification.permission === "denied") return "denied";
  return (await getExistingSubscription().catch(() => null))
    ? "subscribed"
    : "unsubscribed";
}

export function usePushNotifications() {
  const queryClient = useQueryClient();
  const { data: currentUser, isPending: userPending } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
  });
  const user = currentUser?.user ?? null;

  const [device, setDevice] = useState<DeviceState>("loading");
  const [owner, setOwner] = useState<string | null>(null);

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

  const markOwner = (next: string) => {
    writeOwner(next);
    setOwner(next);
  };

  useEffect(() => {
    let active = true;

    (async () => {
      const next = await readDevice();
      if (next === "denied") {
        // Permission was revoked outside the app — prune the now-dead
        // subscription. Best-effort here: reaching "denied" is what matters.
        writeOwner("");
        const endpoint = await unsubscribeFromPush().catch(() => null);
        if (endpoint) void unregister({ endpoint });
      }
      if (!active) return;
      setOwner(readOwner());
      setDevice(next);
    })();

    return () => {
      active = false;
    };
  }, [unregister]);

  // "on" needs both sides: this browser holds a subscription registered to
  // this account, and the server still has push on for the account (pushPrefs
  // drops to 0 with its last device, see server-lib/push-devices.ts).
  let state: PushState;
  if (device !== "subscribed" && device !== "unsubscribed") {
    state = device;
  } else if (userPending) {
    state = "loading";
  } else {
    const registeredHere = owner === null || (!!user && owner === user.id);
    state =
      device === "subscribed" && registeredHere && (user?.pushPrefs ?? 0) !== 0
        ? "on"
        : "off";
  }

  const syncDevice = async () => {
    setOwner(readOwner());
    setDevice(await readDevice());
  };

  const enableMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new ExpectedError("Sign in to enable notifications.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new ExpectedError(
          permission === "denied"
            ? "Notifications are blocked. Re-enable them in your browser or device settings."
            : "Notification permission was not granted.",
        );
      }
      markOwner("");
      const sub = await subscribeToPush(VAPID_PUBLIC_KEY as string);
      const res = await register(sub);
      if ("error" in res) {
        // The browser is subscribed but the server never stored it. Undo it
        // so the next visit doesn't read the subscription as on; if the undo
        // fails too, the cleared owner still keeps it off.
        await unsubscribeFromPush().catch(() => null);
        throw new ExpectedError(res.error);
      }
      markOwner(user.id);
      return res.pushPrefs;
    },
    onSuccess: (pushPrefs) => {
      patchPushPrefs(pushPrefs);
      setDevice("subscribed");
      toast.success("Push notifications enabled.");
    },
    onError: (err: Error) => {
      void syncDevice();
      toast.error(err.message ?? "Couldn't enable notifications.");
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      // Server first: once its row is gone nothing is sent here, so a failed
      // browser unsubscribe only leaves an unused subscription behind. The
      // other order can leave the server pushing to a device that reads off.
      const sub = await getExistingSubscription();
      let pushPrefs: number | null = null;
      if (sub) {
        const res = await unregister({ endpoint: sub.endpoint });
        if ("error" in res) throw new ExpectedError(res.error);
        pushPrefs = res.pushPrefs;
      }
      markOwner("");
      await unsubscribeFromPush().catch(() => null);
      return pushPrefs;
    },
    onSuccess: (pushPrefs) => {
      patchPushPrefs(pushPrefs);
      void syncDevice();
      toast.success("Push notifications disabled.");
    },
    onError: (err: Error) => {
      void syncDevice();
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

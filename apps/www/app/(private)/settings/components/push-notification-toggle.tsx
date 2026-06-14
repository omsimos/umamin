"use client";

import { Switch } from "@umamin/ui/components/switch";
import { cn } from "@umamin/ui/lib/utils";
import { BellIcon } from "lucide-react";
import {
  type PushState,
  usePushNotifications,
} from "@/hooks/use-push-notifications";

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
  const { state, enable, disable, isPending } = usePushNotifications();

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
        onCheckedChange={(checked) => (checked ? enable() : disable())}
      />
    </div>
  );
}

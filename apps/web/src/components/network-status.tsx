import { useEffect, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";

const OFFLINE_TOAST_ID = "network-offline";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const getSnapshot = () => navigator.onLine;
// SSR and hydration assume online; the real value lands after hydration.
const getServerSnapshot = () => true;

export function useIsOnline() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// One persistent toast while the device is offline, cleared on reconnect.
// Without it a failed tap in the installed app just does nothing — the
// browser's own offline UI never shows for in-page fetches.
export function NetworkStatus() {
  const online = useIsOnline();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      toast.warning("You're offline", {
        id: OFFLINE_TOAST_ID,
        description: "Some things won't work until you're back online.",
        duration: Number.POSITIVE_INFINITY,
      });
      return;
    }
    if (wasOffline.current) {
      wasOffline.current = false;
      toast.dismiss(OFFLINE_TOAST_ID);
      toast.success("Back online", { duration: 2500 });
    }
  }, [online]);

  return null;
}

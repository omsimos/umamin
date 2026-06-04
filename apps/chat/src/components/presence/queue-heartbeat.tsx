import { useConvex } from "convex/react";
import { useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { QUEUE_PING_MS } from "../../../convex/constants";
import { getSessionCredentials } from "../../lib/session/session-id";

// While the matching radar is up, keep the queue row marked live so pairing
// only claims people who actually still have the tab open. Background timer
// throttling letting pings go stale is intentional: a hidden tab can't
// establish match presence, so it shouldn't be matchable — pings (and with
// them matchability) resume when the tab returns.
export function QueueHeartbeat() {
  const convex = useConvex();

  useEffect(() => {
    const credentials = getSessionCredentials();
    const ping = () => {
      // Best-effort: a missed ping only delays matchability by one cadence.
      convex.mutation(api.match.stillWaiting, credentials).catch(() => {});
    };

    ping();
    const timer = setInterval(ping, QUEUE_PING_MS);
    // Re-ping immediately on return (tab visible / bfcache restore) so a
    // just-unlocked phone becomes matchable again without waiting a cadence.
    const onVisibilityChange = () => {
      if (!document.hidden) ping();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", ping);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", ping);
    };
  }, [convex]);

  return null;
}

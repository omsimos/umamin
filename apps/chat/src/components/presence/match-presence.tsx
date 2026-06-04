import { useConvex } from "convex/react";
import { useEffect } from "react";
import { api } from "../../../convex/_generated/api";
import { PRESENCE_HEARTBEAT_MS } from "../../../convex/constants";
import { getSessionCredentials, uuid } from "../../lib/session/session-id";

// Must stay mounted for the whole match: heartbeats keep this client present in
// the match's presence room, which is what keeps the match alive server-side.
//
// Deliberately NOT @convex-dev/presence's usePresence: that hook disconnects
// the moment the tab is hidden, so an app switch, screen lock, or notification
// check read as the partner leaving and the match was torn down within one
// reconcile tick. This hook keeps beating while hidden (background timer
// throttling stays within the server's 2.5x staleness window) and only
// disconnects on real departure — unmount or pagehide.
export function MatchPresence({ matchId }: { matchId: string }) {
  const convex = useConvex();

  useEffect(() => {
    // One presence session PER EFFECT RUN, like a browser tab. Sharing an id
    // across runs would let StrictMode's first mount (whose disconnect is
    // deferred until its in-flight beat resolves) tear down the session the
    // second mount is keeping alive — reading as ~30s of "away" on entry.
    // The component treats multiple sessions per user as multi-tab, so the
    // extra dev-mode session is disconnected cleanly by its own cleanup.
    const presenceId = uuid();
    const credentials = getSessionCredentials();
    let sessionToken: string | null = null;
    let inFlight = false;
    let stopped = false;

    const disconnect = () => {
      if (!sessionToken) return;
      convex
        .mutation(api.presence.disconnect, { sessionToken })
        .catch(() => {});
      sessionToken = null;
    };

    const beat = async () => {
      if (inFlight || stopped) return; // single-flight; no beats after cleanup
      inFlight = true;
      try {
        const result = await convex.mutation(api.presence.heartbeat, {
          ...credentials,
          roomId: matchId,
          presenceId,
          interval: PRESENCE_HEARTBEAT_MS,
        });
        if (result) sessionToken = result.sessionToken;
      } catch {
        // Transient failure — the next tick retries and the server's away
        // grace absorbs the gap.
      } finally {
        inFlight = false;
        // Cleanup ran while this beat was in flight: the token only arrived
        // now, so the graceful disconnect has to happen here instead.
        if (stopped) disconnect();
      }
    };

    void beat();
    const timer = setInterval(() => void beat(), PRESENCE_HEARTBEAT_MS);

    // No disconnect on hidden — only an immediate re-beat on return, since iOS
    // freezes background pages entirely and the interval may have missed.
    const onVisibilityChange = () => {
      if (!document.hidden) void beat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    // pagehide is the reliable "really leaving" signal on mobile. keepalive
    // fetch survives page teardown AND completes the CORS preflight that a
    // JSON sendBeacon often drops mid-unload (which silently lost the graceful
    // disconnect and left the partner seeing "online" until the 75s heartbeat
    // timeout). Beacon stays as the fallback for engines without keepalive.
    // A bfcache restore re-establishes via pageshow.
    const onPageHide = () => {
      if (!sessionToken) return;
      const payload = JSON.stringify({
        path: "presence:disconnect",
        args: { sessionToken },
        format: "json",
      });
      try {
        fetch(`${convex.url}/api/mutation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      } catch {
        navigator.sendBeacon(
          `${convex.url}/api/mutation`,
          new Blob([payload], { type: "application/json" }),
        );
      }
      sessionToken = null;
    };
    const onPageShow = () => void beat();
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      disconnect();
    };
  }, [convex, matchId]);

  return null;
}

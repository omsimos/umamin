import usePresence from "@convex-dev/presence/react";
import { api } from "../../../convex/_generated/api";

// Must stay mounted for the whole match: heartbeats keep the partner shown
// online, and unmount/tab-close triggers a disconnect so the survivor's
// snapshot flips to "left" within seconds.
export function MatchPresence({
  matchId,
  sessionId,
}: {
  matchId: string;
  sessionId: string;
}) {
  usePresence(api.presence, matchId, sessionId);
  return null;
}

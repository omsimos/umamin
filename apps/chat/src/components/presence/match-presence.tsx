import usePresence from "@convex-dev/presence/react";
import { api } from "../../../convex/_generated/api";

/**
 * Drives presence heartbeats for the current match room (room = matchId,
 * user = sessionId) while mounted: heartbeats keep the partner shown as online,
 * and tab-close / unmount triggers a graceful disconnect so the survivor's
 * snapshot flips to "left" within seconds. Renders nothing.
 */
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

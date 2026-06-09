import "server-only";

// Per-group tail marker (newest message createdAt, ms) — mirrors the feed's
// `feed:latest` head-key. The send action SETs it; the public chat-head route
// GETs it so members' poll loops collapse to one CDN edge hit and only fetch
// the delta when it advances. Keyed by group id so the head route needs no
// tag→id DB lookup (the client already holds the id).
export function groupChatTailKey(groupId: string) {
  return `group-chat:${groupId}:tail`;
}

// Per-group reaction version (bumped on every react). A reaction on an OLD
// message doesn't advance the message tail, so the poll loop needs this
// separate signal to know it should refetch reaction state for loaded messages.
export function groupChatReactionKey(groupId: string) {
  return `group-chat:${groupId}:rxn`;
}

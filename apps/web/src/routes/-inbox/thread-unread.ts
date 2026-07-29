// Client-side unread check against the viewer's own watermark (the server
// strips the other side's). Wire dates arrive as ISO strings, so normalize.
export function hasUnreadThread(
  lastReplyAt: Date | string | null,
  readAt: Date | string | null,
): boolean {
  if (!lastReplyAt) return false;
  if (!readAt) return true;
  return new Date(lastReplyAt).getTime() > new Date(readAt).getTime();
}

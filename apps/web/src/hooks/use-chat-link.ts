import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { umaminChatUrl } from "@/lib/chat-link";

export type ChatLinkTarget = { href: string; external: boolean };

/**
 * Where a chat entry point goes: the in-app /chat once the `umamin-chat` flag
 * is on, the standalone app until then, so launching is a flag flip with no
 * deploy. While the flags load (and if they fail) it is the external app.
 */
export function useChatLink(utmContent: string): ChatLinkTarget {
  const { chat } = useFeatureFlags();
  return chat
    ? { href: "/chat", external: false }
    : { href: umaminChatUrl(utmContent), external: true };
}

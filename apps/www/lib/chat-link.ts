export const UMAMIN_CHAT_URL = "https://chat.umamin.link";

export function umaminChatUrl(utmContent: string) {
  return `${UMAMIN_CHAT_URL}?utm_source=umamin&utm_medium=referral&utm_content=${utmContent}`;
}

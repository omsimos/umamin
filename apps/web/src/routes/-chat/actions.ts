import { callAction } from "@/lib/api";

// Group-chat mutations (same `Out | { error }` envelope).

export function sendGroupMessageAction(input: {
  groupId: string;
  content: string;
  replyToMessageId?: string;
}) {
  return callAction<{ success: true; id: string; createdAt: string | Date }>(
    "sendGroupMessageAction",
    input,
  );
}

export function markGroupChatReadAction(input: {
  groupId: string;
  lastReadMessageId: string;
}) {
  return callAction<{ success: true }>("markGroupChatReadAction", input);
}

export function deleteGroupMessageAction(input: {
  groupId: string;
  messageId: string;
}) {
  return callAction<{ success: true }>("deleteGroupMessageAction", input);
}

export function reactToGroupMessageAction(input: {
  groupId: string;
  messageId: string;
  emoji: string;
}) {
  return callAction<{ success: true; viewerReaction: string | null }>(
    "reactToGroupMessageAction",
    input,
  );
}

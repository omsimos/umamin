import { callAction } from "@/lib/api";

// Message mutations aren't in lib/actions.ts — call them directly (same
// `Out | { error }` envelope the apps/www call sites branch on).
export function openMessageAction(input: { messageId: string }) {
  return callAction<{ success: boolean; opened: boolean }>(
    "openMessageAction",
    input,
  );
}

export function deleteMessageAction(id: string) {
  return callAction<{ success: boolean }>("deleteMessageAction", id);
}

export function createReplyAction(input: {
  messageId: string;
  content: string;
}) {
  return callAction<{ success: true; reply: string; updatedAt: string | Date }>(
    "createReplyAction",
    input,
  );
}

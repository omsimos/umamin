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
  // `reply`/`updatedAt` come back for the receiver's first (legacy-column)
  // reply; `entry` for every thread row after it.
  return callAction<{
    success: true;
    reply?: string;
    updatedAt?: string | Date;
    entry?: {
      id: string;
      content: string;
      fromSender: boolean;
      createdAt: string | Date;
    };
  }>("createReplyAction", input);
}

export function markThreadReadAction(input: { messageId: string }) {
  return callAction<{ success: boolean }>("markThreadReadAction", input);
}

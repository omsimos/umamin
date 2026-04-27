"use server";

import { apiJson, jsonBody } from "@/lib/api";

export async function deleteMessageAction(id: string) {
  return apiJson(`/api/messages/${id}`, { method: "DELETE" }).catch(() => ({
    error: "An error occurred",
  }));
}

export async function createReplyAction({
  messageId,
  content,
}: {
  messageId: string;
  content: string;
}) {
  return apiJson(`/api/messages/${messageId}/reply`, {
    method: "POST",
    body: jsonBody({ content }),
  }).catch(() => ({ error: "An error occurred" }));
}

export async function sendMessageAction(values: {
  question: string;
  content: string;
  receiverId: string;
}) {
  return apiJson("/api/messages", {
    method: "POST",
    body: jsonBody(values),
  }).catch((error) => ({ error: error.message ?? "An error occurred" }));
}

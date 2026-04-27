"use server";

import { apiJson, jsonBody } from "@/lib/api";

export async function createNoteAction(params: {
  isAnonymous: boolean;
  content: string;
}) {
  return apiJson("/api/notes", {
    method: "POST",
    body: jsonBody(params),
  }).catch((error) => ({ error: error.message ?? "Failed to create note" }));
}

export const getCurrentNoteAction = async () => {
  return apiJson("/api/notes/current");
};

export const clearNoteAction = async () => {
  return apiJson("/api/notes/current", { method: "DELETE" }).catch(() => ({
    error: "Failed to clear note",
  }));
};

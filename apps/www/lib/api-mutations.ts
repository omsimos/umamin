"use client";

import type { SelectNote } from "@umamin/db/schema/note";
import type { SelectPost, SelectPostComment } from "@umamin/db/schema/post";
import type * as z from "zod";
import {
  deleteJson,
  getApiOrigin,
  getJson,
  patchJson,
  postJson,
} from "@/lib/api-client";
import type { registerSchema } from "@/lib/schema";
import type { generalSettingsSchema, passwordFormSchema } from "@/types/user";

type Success = { success: true };

export function login(values: { username: string; password: string }) {
  const body = new FormData();
  body.set("username", values.username);
  body.set("password", values.password);

  return fetch(`${getApiOrigin()}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    body,
  }).then(async (response) => {
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      throw new Error(body?.error?.message ?? "An unexpected error occurred");
    }
    return (await response.json()) as Success;
  });
}

export function signup(values: z.infer<typeof registerSchema>) {
  return postJson<Success>("/api/auth/signup", values);
}

export function logout() {
  return postJson<Success>("/api/auth/logout");
}

export function createPost(values: { content: string }) {
  return postJson<Success & { post: SelectPost }>("/api/posts", values);
}

export function deletePost(values: { postId: string }) {
  return deleteJson<Success>(`/api/posts/${values.postId}`);
}

export function createComment(values: { postId: string; content: string }) {
  return postJson<Success & { comment?: SelectPostComment }>(
    `/api/posts/${values.postId}/comments`,
    { content: values.content },
  );
}

export function addLike(values: { postId: string }) {
  return postJson<Success & { alreadyLiked?: true }>(
    `/api/posts/${values.postId}/like`,
  );
}

export function removeLike(values: { postId: string }) {
  return deleteJson<Success & { alreadyRemoved?: true }>(
    `/api/posts/${values.postId}/like`,
  );
}

export function addCommentLike(values: { commentId: string; postId?: string }) {
  return postJson<Success & { alreadyLiked?: true }>(
    `/api/comments/${values.commentId}/like`,
  );
}

export function removeCommentLike(values: {
  commentId: string;
  postId?: string;
}) {
  return deleteJson<Success & { alreadyRemoved?: true }>(
    `/api/comments/${values.commentId}/like`,
  );
}

export function addRepost(values: { postId: string; content?: string }) {
  return postJson<Success & { alreadyReposted?: true }>(
    `/api/posts/${values.postId}/repost`,
    { content: values.content ?? "" },
  );
}

export function removeRepost(values: { postId: string }) {
  return deleteJson<Success & { alreadyRemoved?: true }>(
    `/api/posts/${values.postId}/repost`,
  );
}

export function createNote(values: { isAnonymous: boolean; content: string }) {
  return postJson<Success & { note: SelectNote }>("/api/notes", values);
}

export function clearNote() {
  return deleteJson<Success>("/api/notes/current");
}

export function sendMessage(values: {
  question: string;
  content: string;
  receiverId: string;
}) {
  return postJson<Success>("/api/messages", values);
}

export function deleteMessage(id: string) {
  return deleteJson<Success>(`/api/messages/${id}`);
}

export function createReply(values: { messageId: string; content: string }) {
  return postJson<Success & { reply: string; updatedAt: Date }>(
    `/api/messages/${values.messageId}/reply`,
    { content: values.content },
  );
}

export function updateGeneralSettings(
  values: z.infer<typeof generalSettingsSchema>,
) {
  return patchJson<
    Success & { user: Partial<z.infer<typeof generalSettingsSchema>> }
  >("/api/settings/general", values);
}

export function updatePassword(values: z.infer<typeof passwordFormSchema>) {
  return patchJson<Success>("/api/settings/password", values);
}

export function deleteAccount() {
  return deleteJson<Success>("/api/account");
}

export function followUser(values: { userId: string }) {
  return postJson<Success & { alreadyFollowing?: true }>(
    `/api/users/${values.userId}/follow`,
  );
}

export function unfollowUser(values: { userId: string }) {
  return deleteJson<Success & { alreadyRemoved?: true }>(
    `/api/users/${values.userId}/follow`,
  );
}

export function blockUser(values: { userId: string }) {
  return postJson<Success & { alreadyBlocked?: true }>(
    `/api/users/${values.userId}/block`,
  );
}

export function unblockUser(values: { userId: string }) {
  return deleteJson<Success & { alreadyRemoved?: true }>(
    `/api/users/${values.userId}/block`,
  );
}

export function getGravatar(email: string) {
  return getJson<{ url: string }>(
    `/api/gravatar?email=${encodeURIComponent(email)}`,
  );
}

export function toggleDisplayPicture(accountImgUrl?: string) {
  return patchJson<Success & { imageUrl: string | null }>(
    "/api/settings/display-picture",
    { accountImgUrl },
  );
}

export function toggleQuietMode() {
  return patchJson<Success & { quietMode: boolean }>(
    "/api/settings/quiet-mode",
  );
}

export function updateAvatar(imageUrl: string) {
  return patchJson<Success & { imageUrl: string }>("/api/settings/avatar", {
    imageUrl,
  });
}

export function googleAuthUrl() {
  return `${getApiOrigin()}/auth/google`;
}

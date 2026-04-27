"use server";

import { apiJson, jsonBody } from "@/lib/api";
import { getPostById } from "@/lib/server/data";

export async function getPostAction(id: string) {
  return getPostById({ postId: id, viewerId: "current" });
}

export async function getPostPublicAction(id: string) {
  return getPostById({ postId: id });
}

export async function createPostAction(values: { content: string }) {
  return apiJson("/api/posts", {
    method: "POST",
    body: jsonBody(values),
  }).catch(() => ({ error: "An error occurred" }));
}

export async function deletePostAction({ postId }: { postId: string }) {
  return apiJson(`/api/posts/${postId}`, { method: "DELETE" }).catch(() => ({
    error: "An error occurred",
  }));
}

export async function createCommentAction(values: {
  postId: string;
  content: string;
}) {
  return apiJson(`/api/posts/${values.postId}/comments`, {
    method: "POST",
    body: jsonBody({ content: values.content }),
  }).catch(() => ({ error: "An error occurred" }));
}

export async function addLikeAction({ postId }: { postId: string }) {
  return apiJson(`/api/posts/${postId}/like`, { method: "POST" }).catch(() => ({
    error: "An error occurred",
  }));
}

export async function removeLikeAction({ postId }: { postId: string }) {
  return apiJson(`/api/posts/${postId}/like`, { method: "DELETE" }).catch(
    () => ({ error: "An error occurred" }),
  );
}

export async function addCommentLikeAction({
  commentId,
}: {
  commentId: string;
  postId?: string;
}) {
  return apiJson(`/api/comments/${commentId}/like`, { method: "POST" }).catch(
    () => ({ error: "An error occurred" }),
  );
}

export async function removeCommentLikeAction({
  commentId,
}: {
  commentId: string;
  postId?: string;
}) {
  return apiJson(`/api/comments/${commentId}/like`, { method: "DELETE" }).catch(
    () => ({ error: "An error occurred" }),
  );
}

export async function addRepostAction(values: {
  postId: string;
  content?: string;
}) {
  return apiJson(`/api/posts/${values.postId}/repost`, {
    method: "POST",
    body: jsonBody({ content: values.content ?? "" }),
  }).catch(() => ({ error: "An error occurred" }));
}

export async function removeRepostAction({ postId }: { postId: string }) {
  return apiJson(`/api/posts/${postId}/repost`, { method: "DELETE" }).catch(
    () => ({ error: "An error occurred" }),
  );
}

import { callAction } from "@/lib/api";

// Colocated action wrappers for the social pages, mirroring the apps/www
// `@/app/actions/*` named exports so the ported component call sites — and their
// `res.error` / `"x" in res` narrowing — port over unchanged (only the import
// source moves to this module). Each is a thin typed `callAction("<name>", …)`;
// the endpoint names match the flat `/api/actions/<name>` contract exactly.
//
// These live under the route group (not `@/lib/actions`) to respect Phase 3b
// file ownership; a handful overlap `@/lib/actions` by design. Success types
// cover only the fields the components read (plus the always-present optional
// `error`), matching how apps/www typed them as merged results rather than
// unions — see `@/lib/actions` createPostAction for the same pattern.

type ErrorResult = { error?: string };

// ── post ─────────────────────────────────────────────────────────────────────
type LikeResult = ErrorResult & {
  alreadyLiked?: boolean;
  alreadyRemoved?: boolean;
  success?: boolean;
};

export function addLikeAction(input: { postId: string }) {
  return callAction<LikeResult>("addLikeAction", input) as Promise<LikeResult>;
}

export function removeLikeAction(input: { postId: string }) {
  return callAction<LikeResult>(
    "removeLikeAction",
    input,
  ) as Promise<LikeResult>;
}

export function addCommentLikeAction(input: { commentId: string }) {
  return callAction<LikeResult>(
    "addCommentLikeAction",
    input,
  ) as Promise<LikeResult>;
}

export function removeCommentLikeAction(input: { commentId: string }) {
  return callAction<LikeResult>(
    "removeCommentLikeAction",
    input,
  ) as Promise<LikeResult>;
}

type RepostResult = ErrorResult & {
  alreadyReposted?: boolean;
  alreadyRemoved?: boolean;
  success?: boolean;
};

export function addRepostAction(input: { postId: string }) {
  return callAction<RepostResult>(
    "addRepostAction",
    input,
  ) as Promise<RepostResult>;
}

export function removeRepostAction(input: { postId: string }) {
  return callAction<RepostResult>(
    "removeRepostAction",
    input,
  ) as Promise<RepostResult>;
}

export function deletePostAction(input: { postId: string }) {
  return callAction<ErrorResult & { success?: boolean }>(
    "deletePostAction",
    input,
  ) as Promise<ErrorResult & { success?: boolean }>;
}

export function pinPostAction(input: { postId: string }) {
  return callAction<ErrorResult & { success?: boolean }>(
    "pinPostAction",
    input,
  ) as Promise<ErrorResult & { success?: boolean }>;
}

export function unpinPostAction() {
  return callAction<ErrorResult & { success?: boolean }>(
    "unpinPostAction",
    {},
  ) as Promise<ErrorResult & { success?: boolean }>;
}

export function deleteCommentAction(input: { commentId: string }) {
  return callAction<ErrorResult & { success?: boolean }>(
    "deleteCommentAction",
    input,
  ) as Promise<ErrorResult & { success?: boolean }>;
}

// The comment result carries the created row so reply-form can swap the
// optimistic entry. Typed loosely (`unknown`) — the caller only reads `.comment`
// and `.error`, and it's re-cast at the call site to the concrete CommentData.
export function createCommentAction(input: {
  content: string;
  postId: string;
}) {
  return callAction<ErrorResult & { comment?: Record<string, unknown> }>(
    "createCommentAction",
    input,
  ) as Promise<ErrorResult & { comment?: Record<string, unknown> }>;
}

// ── note ───────────────────────────────────────────────────────────────────
type NoteReactionResult = ErrorResult & {
  alreadyReacted?: boolean;
  alreadyRemoved?: boolean;
  success?: boolean;
};

export function addNoteReactionAction(input: { noteId: string }) {
  return callAction<NoteReactionResult>(
    "addNoteReactionAction",
    input,
  ) as Promise<NoteReactionResult>;
}

export function removeNoteReactionAction(input: { noteId: string }) {
  return callAction<NoteReactionResult>(
    "removeNoteReactionAction",
    input,
  ) as Promise<NoteReactionResult>;
}

export function removeNoteAction(input: { noteId: string }) {
  return callAction<ErrorResult & { success?: boolean }>(
    "removeNoteAction",
    input,
  ) as Promise<ErrorResult & { success?: boolean }>;
}

export function clearNoteAction() {
  return callAction<ErrorResult & { success?: boolean }>(
    "clearNoteAction",
    {},
  ) as Promise<ErrorResult & { success?: boolean }>;
}

// note is the freshly-upserted row; typed loosely and re-cast where consumed.
export function createNoteAction(input: {
  content?: string;
  isAnonymous?: boolean;
  musicUrl?: string;
}) {
  return callAction<ErrorResult & { note?: Record<string, unknown> }>(
    "createNoteAction",
    input,
  ) as Promise<ErrorResult & { note?: Record<string, unknown> }>;
}

// ── message ──────────────────────────────────────────────────────────────────
export function sendMessageAction(input: {
  receiverId?: string;
  question?: string | null;
  content: string;
}) {
  return callAction<ErrorResult & { success?: boolean }>(
    "sendMessageAction",
    input,
  ) as Promise<ErrorResult & { success?: boolean }>;
}

// ── user ─────────────────────────────────────────────────────────────────────
type FollowResult = ErrorResult & {
  alreadyFollowing?: boolean;
  alreadyRemoved?: boolean;
};

export function followUserAction(input: { userId: string }) {
  return callAction<FollowResult>(
    "followUserAction",
    input,
  ) as Promise<FollowResult>;
}

export function unfollowUserAction(input: { userId: string }) {
  return callAction<FollowResult>(
    "unfollowUserAction",
    input,
  ) as Promise<FollowResult>;
}

type BlockResult = ErrorResult & {
  alreadyBlocked?: boolean;
  alreadyRemoved?: boolean;
};

export function blockUserAction(input: { userId: string }) {
  return callAction<BlockResult>(
    "blockUserAction",
    input,
  ) as Promise<BlockResult>;
}

export function unblockUserAction(input: { userId: string }) {
  return callAction<BlockResult>(
    "unblockUserAction",
    input,
  ) as Promise<BlockResult>;
}

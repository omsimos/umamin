import type * as z from "zod";
import { callAction } from "@/lib/api";
import type { createGroupSchema, updateGroupSchema } from "@/lib/group";
import type { PollDuration } from "@/lib/poll";
import type { PostImageInput } from "@/lib/post-images";
import type { PollData, PostData } from "@/lib/types";

// Typed client wrappers over the ported Hono action endpoints
// (`POST /api/actions/<name>`). Each mirrors the name + input shape of the
// apps/www server action it replaces, so the component call sites — and their
// `Out | { error }` union narrowing — port over UNCHANGED (only the import
// source moves from `@/app/actions/*` to `@/lib/actions`). The success `Out`
// types cover exactly the fields the ported components read off the result;
// `callAction` normalizes every failure to `{ error }` without throwing.

type CreateGroupInput = z.infer<typeof createGroupSchema>;
type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

type CreateGroupOut = {
  group: {
    id: string;
    tag: string;
    name: string;
    icon: string;
    accent: string | null;
  };
};

export function createGroupAction(input: CreateGroupInput) {
  return callAction<CreateGroupOut>("createGroupAction", input);
}

export function updateGroupAction(input: UpdateGroupInput) {
  return callAction<{ ok?: true }>("updateGroupAction", input);
}

type VotePollOut = {
  ok?: boolean;
  alreadyVoted?: boolean;
  votedOptionId?: string;
};

export function votePollAction(input: { optionId: string }) {
  return callAction<VotePollOut>("votePollAction", input);
}

export function blockUserAction(input: { userId: string }) {
  return callAction<{ success?: boolean }>("blockUserAction", input);
}

type FollowOut = { alreadyFollowing?: boolean; alreadyRemoved?: boolean };

export function followUserAction(input: { userId: string }) {
  return callAction<FollowOut>("followUserAction", input);
}

export function unfollowUserAction(input: { userId: string }) {
  return callAction<FollowOut>("unfollowUserAction", input);
}

export function banUserAction(input: { username: string; reason?: string }) {
  return callAction<{ success?: boolean }>("banUserAction", input);
}

export function unbanUserAction(input: { username: string }) {
  return callAction<{ success?: boolean }>("unbanUserAction", input);
}

// The composer hooks (`useCreatePost`, `useImageAttachments`) read `res.error`
// AND success fields off the same value (`res?.error`, `"post" in res`,
// `"uploads" in res`), so these wrappers expose a single merged result object
// rather than the `Out | { error }` union — matching how apps/www typed them.

type CreatePostInput = {
  content: string;
  images?: PostImageInput[];
  poll?: { options: string[]; duration: PollDuration };
  quotedPostId?: string;
};

type CreatePostResult = {
  error?: string;
  post?: PostData;
  poll?: PollData | null;
};

export function createPostAction(
  input: CreatePostInput,
): Promise<CreatePostResult> {
  return callAction<CreatePostResult>(
    "createPostAction",
    input,
  ) as Promise<CreatePostResult>;
}

type PresignInput = {
  images: { contentType: string; contentLength: number }[];
};

type PresignResult = {
  error?: string;
  uploads?: { key: string; url: string }[];
};

export function presignPostImagesAction(
  input: PresignInput,
): Promise<PresignResult> {
  return callAction<PresignResult>(
    "presignPostImagesAction",
    input,
  ) as Promise<PresignResult>;
}

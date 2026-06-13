import type {
  PostImage,
  SelectPost,
  SelectPostComment,
} from "@umamin/db/schema/post";
import type { FeedAuthor, FeedAuthorWithBadge } from "./user";

export type PostImageDisplay = PostImage & {
  // Local object URL carried by the optimistic post so the just-attached
  // images render instantly (and never refetch) instead of round-tripping R2.
  previewUrl?: string;
};

export type PollOptionData = {
  id: string;
  idx: number;
  label: string;
  voteCount: number;
};

export type PollData = {
  endsAt: Date;
  // Sorted by idx; percentages/totals are computed in the card (lib/poll),
  // never stored.
  options: PollOptionData[];
  // Overlay-only: undefined = viewer unknown (public/profile reads),
  // null = known not-voted, string = the option the viewer picked.
  myVoteOptionId?: string | null;
};

// The embedded card inside a quote post. Never carries viewer overlays, a
// nested quotedPost, or a live poll — embedding stops at one level (the card
// links through; pollEndsAt alone drives a static "Poll" indicator).
export type QuotedPostData = Omit<SelectPost, "images"> & {
  images?: PostImageDisplay[] | null;
  author: FeedAuthor;
};

export type PostData = Omit<SelectPost, "images"> & {
  images?: PostImageDisplay[] | null;
  // Set when quotedPostId is set: the resolved post, or null when it's been
  // deleted / its author is blocked — rendered as an "unavailable" husk.
  quotedPost?: QuotedPostData | null;
  // Set when pollEndsAt is set; null only if the option rows are missing.
  poll?: PollData | null;
  author: FeedAuthorWithBadge;
  comments?: SelectPostComment[];
  isLiked?: boolean;
  isReposted?: boolean;
  // Set only by the profile posts page, on the author's pinned post.
  isPinned?: boolean;
};

// Strips viewer overlays + the nested embed so quote composers/optimistic
// items carry exactly the documented QuotedPostData shape.
export function toQuotedPostData(post: PostData): QuotedPostData {
  const {
    quotedPost: _quotedPost,
    poll: _poll,
    comments: _comments,
    isLiked: _isLiked,
    isReposted: _isReposted,
    ...rest
  } = post;
  return rest;
}

export type CommentData = SelectPostComment & {
  author: FeedAuthorWithBadge;
  isLiked?: boolean;
};

export type RepostData = {
  id: string;
  postId: string;
  createdAt: Date;
  user: FeedAuthorWithBadge;
};

export type FeedItem =
  | { type: "post"; post: PostData }
  | { type: "repost"; post: PostData; repost: RepostData };

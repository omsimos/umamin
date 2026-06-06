import type {
  PostImage,
  SelectPost,
  SelectPostComment,
} from "@umamin/db/schema/post";
import type { PublicUser } from "./user";

export type PostImageDisplay = PostImage & {
  // Local object URL carried by the optimistic post so the just-attached
  // images render instantly (and never refetch) instead of round-tripping R2.
  previewUrl?: string;
};

// The embedded card inside a quote post. Never carries viewer overlays or a
// nested quotedPost — embedding stops at one level (the card links through).
export type QuotedPostData = Omit<SelectPost, "images"> & {
  images?: PostImageDisplay[] | null;
  author: PublicUser;
};

export type PostData = Omit<SelectPost, "images"> & {
  images?: PostImageDisplay[] | null;
  // Set when quotedPostId is set: the resolved post, or null when it's been
  // deleted / its author is blocked — rendered as an "unavailable" husk.
  quotedPost?: QuotedPostData | null;
  author: PublicUser;
  comments?: SelectPostComment[];
  isLiked?: boolean;
  isReposted?: boolean;
};

// Strips viewer overlays + the nested embed so quote composers/optimistic
// items carry exactly the documented QuotedPostData shape.
export function toQuotedPostData(post: PostData): QuotedPostData {
  const {
    quotedPost: _quotedPost,
    comments: _comments,
    isLiked: _isLiked,
    isReposted: _isReposted,
    ...rest
  } = post;
  return rest;
}

export type CommentData = SelectPostComment & {
  author: PublicUser;
  isLiked?: boolean;
};

export type RepostData = {
  id: string;
  postId: string;
  createdAt: Date;
  user: PublicUser;
};

export type FeedItem =
  | { type: "post"; post: PostData }
  | { type: "repost"; post: PostData; repost: RepostData };

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

export type PostData = Omit<SelectPost, "images"> & {
  images?: PostImageDisplay[] | null;
  author: PublicUser;
  comments?: SelectPostComment[];
  isLiked?: boolean;
  isReposted?: boolean;
};

export type CommentData = SelectPostComment & {
  author: PublicUser;
  isLiked?: boolean;
};

export type RepostData = {
  id: string;
  postId: string;
  content?: string | null;
  createdAt: Date;
  user: PublicUser;
};

export type FeedItem =
  | { type: "post"; post: PostData }
  | { type: "repost"; post: PostData; repost: RepostData };

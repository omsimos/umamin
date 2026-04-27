import type { SelectPost, SelectPostComment } from "@umamin/db/schema/post";
import type { PublicUser } from "./user";

export type PostData = SelectPost & {
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

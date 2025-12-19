import type { SelectPost, SelectPostComment } from "@umamin/db/schema/post";
import type { PublicUser } from "./user";

export type PostData = SelectPost & {
  author: PublicUser;
  comments?: SelectPostComment[];
  isLiked?: boolean;
};

export type CommentData = SelectPostComment & {
  author: PublicUser;
  isLiked?: boolean;
};

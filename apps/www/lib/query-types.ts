import type { SelectMessage } from "@umamin/db/schema/message";
import type { SelectNote } from "@umamin/db/schema/note";
import type { SelectAccount, SelectUser } from "@umamin/db/schema/user";
import type { CommentData, FeedItem, PostData } from "@/types/post";
import type { PublicUser } from "@/types/user";

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
};

export type FeedResponse = CursorPage<FeedItem>;

export type PostResponse = PostData | null;

export type CommentsResponse = CursorPage<CommentData>;

export type NoteItem = SelectNote & {
  user?: PublicUser;
};

export type NotesResponse = CursorPage<NoteItem>;

export type MessageWithReceiver = SelectMessage & {
  receiver: PublicUser;
};

export type MessagesResponse = {
  messages: MessageWithReceiver[];
  nextCursor: string | null;
};

export type CurrentUserData = SelectUser & {
  accounts: SelectAccount[];
};

export type CurrentUserResponse = {
  user?: CurrentUserData;
};

export type UserProfileResponse = PublicUser | null;

export type UserProfileViewerResponse = {
  currentUserId: string | null;
  isAuthenticated: boolean;
  isFollowing: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
};

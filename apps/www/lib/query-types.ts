import type { SelectMessage } from "@umamin/db/schema/message";
import type { SelectNote } from "@umamin/db/schema/note";
import type { NotificationType } from "@umamin/db/schema/notification";
import type { SelectAccount } from "@umamin/db/schema/user";
import type { CommentData, FeedItem, PostData } from "@/types/post";
import type { CurrentUserClient, PublicUser } from "@/types/user";

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
};

export type FeedResponse = CursorPage<FeedItem>;

export type PostResponse = PostData | null;

export type CommentsResponse = CursorPage<CommentData>;

export type NoteItem = SelectNote & {
  user?: PublicUser;
  isReacted?: boolean;
};

export type NotesResponse = CursorPage<NoteItem>;

export type MessageWithReceiver = SelectMessage & {
  receiver: PublicUser;
  // Received messages set senderId=null and expose only this flag for the block
  // UI — the sender's account id never reaches the client (anonymity). Blocking
  // resolves the sender server-side from the message id. [audit #22]
  canBlock?: boolean;
};

export type MessagesResponse = {
  messages: MessageWithReceiver[];
  nextCursor: string | null;
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  targetId: string;
  count: number;
  preview: string | null;
  updatedAt: Date;
  // Latest actor only (aggregated rows overwrite it); null = anonymous or
  // deleted account.
  actor: {
    username: string;
    displayName: string | null;
    imageUrl: string | null;
  } | null;
};

export type NotificationsResponse = {
  notifications: NotificationItem[];
  nextCursor: string | null;
};

export type NotificationBadgeResponse = {
  unseen: number;
};

export type CurrentUserData = CurrentUserClient & {
  accounts: SelectAccount[];
};

export type CurrentUserResponse = {
  user?: CurrentUserData;
};

export type FollowListUser = PublicUser & {
  isFollowing: boolean;
};

export type FollowListResponse = {
  data: FollowListUser[];
  nextCursor: string | null;
  viewerId: string | null;
};

export type UserProfileResponse = PublicUser | null;

export type UserProfileViewerResponse = {
  currentUserId: string | null;
  isAuthenticated: boolean;
  isFollowing: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
};

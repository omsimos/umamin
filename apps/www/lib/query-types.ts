import type { GroupMemberRole } from "@umamin/db/schema/group";
import type { SelectMessage } from "@umamin/db/schema/message";
import type { SelectNote } from "@umamin/db/schema/note";
import type { NotificationType } from "@umamin/db/schema/notification";
import type { SelectAccount } from "@umamin/db/schema/user";
import type { CommentData, FeedItem, PostData } from "@/types/post";
import type {
  CurrentUserClient,
  PublicUser,
  PublicUserWithBadge,
} from "@/types/user";

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
};

export type FeedResponse = CursorPage<FeedItem>;

export type PostResponse = PostData | null;

export type CommentsResponse = CursorPage<CommentData>;

export type NoteItem = SelectNote & {
  user?: PublicUserWithBadge;
  isReacted?: boolean;
};

export type NotesResponse = CursorPage<NoteItem>;

export type MessageWithReceiver = SelectMessage & {
  receiver: PublicUser;
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

export type BlockedUser = PublicUser & {
  blockedAt: Date;
};

export type BlockedUsersResponse = CursorPage<BlockedUser>;

export type FollowListUser = PublicUserWithBadge & {
  isFollowing: boolean;
};

export type FollowListResponse = {
  data: FollowListUser[];
  nextCursor: string | null;
  viewerId: string | null;
};

export type UserProfileResponse = PublicUserWithBadge | null;

export type GroupPageData = {
  id: string;
  name: string;
  description: string | null;
  tag: string;
  icon: string;
  accent: string | null;
  memberCount: number;
  createdAt: Date;
  // Accountability line ("Created by") — null if the account is mid-delete.
  creator: { username: string; displayName: string | null } | null;
};

export type GroupMemberItem = {
  id: string;
  role: GroupMemberRole;
  joinedAt: Date;
  user: PublicUser;
};

export type GroupMembersResponse = CursorPage<GroupMemberItem>;

export type UserGroupItem = {
  group: {
    id: string;
    name: string;
    tag: string;
    icon: string;
    accent: string | null;
    memberCount: number;
  };
  role: GroupMemberRole;
  joinedAt: Date;
};

export type UserGroupInviteItem = {
  group: {
    id: string;
    name: string;
    tag: string;
    icon: string;
    accent: string | null;
    memberCount: number;
  };
  invitedAt: Date;
};

export type UserGroupsResponse = {
  data: UserGroupItem[];
  // Pending invites this user can accept/decline — surfaced in the hub so a
  // forgotten invite isn't stranded once its notification ages out.
  invites: UserGroupInviteItem[];
};

// "owner"/"member" are active membership; "invited"/"requested" are pending.
export type GroupRelationship = "owner" | "member" | "invited" | "requested";

export type GroupViewerResponse = {
  isAuthenticated: boolean;
  // null = signed in but no relationship to the group.
  relationship: GroupRelationship | null;
};

export type GroupRequestItem = {
  id: string;
  requestedAt: Date;
  user: PublicUser;
};

export type GroupRequestsResponse = CursorPage<GroupRequestItem>;

export type UserProfileViewerResponse = {
  currentUserId: string | null;
  isAuthenticated: boolean;
  isFollowing: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
};

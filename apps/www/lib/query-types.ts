import type { GroupMemberRole } from "@umamin/db/schema/group";
import type { SelectMessage } from "@umamin/db/schema/message";
import type { SelectNote } from "@umamin/db/schema/note";
import type { NotificationType } from "@umamin/db/schema/notification";
import type { SelectAccount } from "@umamin/db/schema/user";
import type { MusicAttachment } from "@/lib/music";
import type { GroupBadgeData } from "@/types/group";
import type { CommentData, FeedItem, PostData } from "@/types/post";
import type {
  CurrentUserClient,
  FeedAuthor,
  FeedAuthorWithBadge,
  PublicUserWithBadge,
} from "@/types/user";

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
};

export type FeedResponse = CursorPage<FeedItem>;

export type PostResponse = PostData | null;

export type CommentsResponse = CursorPage<CommentData>;

// The raw note columns carrying a song attachment are replaced by a single lean
// `music` object (see resolveNoteMusic in lib/server/data.ts) so the payload
// stays compact and the legacy spotify_* columns never reach the client.
export type NoteItem = Omit<
  SelectNote,
  | "musicProvider"
  | "musicId"
  | "musicTitle"
  | "musicThumbnail"
  | "spotifyTrackId"
  | "spotifyTitle"
  | "spotifyThumbnail"
> & {
  user?: FeedAuthorWithBadge;
  isReacted?: boolean;
  music: MusicAttachment | null;
};

export type NotesResponse = CursorPage<NoteItem>;

export type MessageWithReceiver = SelectMessage & {
  receiver: FeedAuthor;
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
  // Server-computed maintainer flag (from MODERATOR_USERS). Gates the in-app
  // "Remove" action on others' content; the roster itself never reaches the
  // client. See lib/server/moderation.ts.
  isModerator: boolean;
};

export type CurrentUserResponse = {
  user?: CurrentUserData;
};

export type BlockedUser = FeedAuthor & {
  blockedAt: Date;
};

export type BlockedUsersResponse = CursorPage<BlockedUser>;

export type FollowListUser = FeedAuthorWithBadge & {
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
  user: FeedAuthor;
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
  user: FeedAuthor;
};

export type GroupRequestsResponse = CursorPage<GroupRequestItem>;

// Compact author projection — only what a chat bubble renders, so the poll
// payload (Fast Origin Transfer) stays small. NOT the full PublicUser.
export type GroupChatSender = {
  id: string;
  username: string;
  displayName: string | null;
  imageUrl: string | null;
  equippedGroupId: string | null;
  groupBadge: GroupBadgeData | null;
};

// Compact quoted preview of the replied-to message (content truncated
// server-side to keep the poll payload small).
export type GroupChatReplyPreview = {
  id: string;
  content: string;
  senderName: string;
};

export type GroupChatMessage = {
  id: string;
  // Decrypted server-side; encrypted at rest.
  content: string;
  createdAt: Date;
  sender: GroupChatSender;
  replyTo: GroupChatReplyPreview | null;
};

export type GroupChatResponse = CursorPage<GroupChatMessage>;

// Newest message marker (createdAt ms) + reaction version, CDN-cached so
// members' polls collapse to one edge hit. null = Redis unconfigured (client
// polls the delta directly; reaction updates become eventual on reload).
export type GroupChatHeadResponse = {
  tail: number | null;
  rxn: number | null;
};

// Aggregate reaction state for one message + the viewer's own pick. Only
// messages that actually have reactions are returned (compact payload).
export type GroupMessageReactionState = {
  messageId: string;
  reactions: { emoji: string; count: number }[];
  viewerReaction: string | null;
};

export type GroupChatReactionsResponse = GroupMessageReactionState[];

// One reactor + the emoji they used, for the "who reacted" drawer.
export type GroupMessageReactor = {
  emoji: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
    imageUrl: string | null;
  };
};

export type GroupReactorsResponse = GroupMessageReactor[];

// Per-group unread flag for the hub dot — derived from the group's
// lastMessageAt vs the viewer's read watermark (no COUNT, no scan).
export type GroupUnreadState = {
  groupId: string;
  hasUnread: boolean;
};

export type GroupUnreadResponse = GroupUnreadState[];

export type UserProfileViewerResponse = {
  currentUserId: string | null;
  isAuthenticated: boolean;
  isFollowing: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
  // Moderator-only: whether the profile owner is currently banned. Always false
  // for non-moderators (ban state never leaks). Gates the profile "Unban"/"Ban"
  // menu entry. See getUserProfileViewerData.
  isBanned: boolean;
};

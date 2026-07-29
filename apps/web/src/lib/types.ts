import type { GroupMemberRole, SelectGroup } from "@umamin/db/schema/group";
import type { SelectMessage } from "@umamin/db/schema/message";
import type { SelectNote } from "@umamin/db/schema/note";
import type { NotificationType } from "@umamin/db/schema/notification";
import type {
  PostImage,
  SelectPost,
  SelectPostComment,
} from "@umamin/db/schema/post";
import type { SelectAccount, SelectUser } from "@umamin/db/schema/user";
import * as z from "zod";
import type { MusicAttachment } from "./music";

// Client-safe domain types, consolidated from apps/www's lib/query-types.ts +
// types/{group,user,post}.ts (the port collapses the 4-file split into one
// client-importable module). Runtime helpers here (toPublicUser,
// toQuotedPostData, the settings zod schemas) are pure and safe on both sides.
// The two author projections (FeedAuthor vs PublicUser) and their payload-size
// invariant are preserved EXACTLY — a schema column add must be added to the
// projection it belongs to (see feedAuthorColumns/publicUserColumns in data.ts).

// ── group ──────────────────────────────────────────────────────────────────

// The badge payload that rides cached feed/profile responses next to author
// data — id only links to the group page; never internal columns.
export type GroupBadgeData = Pick<
  SelectGroup,
  "id" | "tag" | "icon" | "accent"
>;

// ── user ───────────────────────────────────────────────────────────────────

// lastSeenNotificationsAt is the viewer's own notification watermark,
// blockedWords the viewer's own message filter, and pushPrefs the viewer's own
// push-notification setting — private state, never part of a public (or even
// own-profile) payload. bannerImageUrl is profile-header-only (re-added on
// PublicUserWithBadge), kept out of the per-author payloads that
// publicUserColumns feeds so feed/note/comment lists stay compact. The raw
// music_* columns are dropped too — the profile read resolves them into a lean
// `music` object (re-added on PublicUserWithBadge), mirroring NoteItem.music.
export type PublicUser = Omit<
  SelectUser,
  | "passwordHash"
  | "lastSeenNotificationsAt"
  | "blockedWords"
  | "bannerImageUrl"
  | "pushPrefs"
  | "musicProvider"
  | "musicId"
  | "musicTitle"
  | "musicThumbnail"
  // Moderation state is server-only — never expose ban status (or its reason/
  // author) on any payload. Surfaced to moderators via the profile-viewer read.
  | "bannedAt"
  | "banReason"
  | "bannedBy"
>;

// Author shape on badge-rendering surfaces. Optional so optimistic client
// items can omit it (the badge appears on the server swap); null = no badge
// equipped or the group is gone. bannerImageUrl + music are only selected on
// the profile + current-user reads — undefined on author payloads (and so never
// rendered). music = the resolved profile song (null = none attached).
export type PublicUserWithBadge = PublicUser & {
  groupBadge?: GroupBadgeData | null;
  bannerImageUrl?: string | null;
  music?: MusicAttachment | null;
};

// Lean author shape for LIST surfaces (feed/notes/comments/messages/follow/
// members) — structurally matches feedAuthorColumns in server-lib/data.ts.
// Drops bio/question/follower+followingCount/updatedAt/pinnedPostId that no list
// renderer reads, to cut Fast Origin Transfer. Distinct from PublicUser so the
// compiler rejects any list code that reaches for a dropped field. The full
// PublicUser stays on profile + current-user reads.
export type FeedAuthor = Omit<
  PublicUser,
  | "bio"
  | "question"
  | "followerCount"
  | "followingCount"
  | "updatedAt"
  | "pinnedPostId"
>;

export type FeedAuthorWithBadge = FeedAuthor & {
  groupBadge?: GroupBadgeData | null;
  bannerImageUrl?: string | null;
};

export type CurrentUserClient = PublicUserWithBadge & {
  hasPassword: boolean;
  blockedWords: string[] | null;
  // Push-notification preference bitmask (0 = off). Owner-private — only ever
  // served to the user's own session (mirrors blockedWords/hasPassword).
  pushPrefs: number;
};
export type UserWithAccount = CurrentUserClient & {
  account: SelectAccount | null;
};

export function toPublicUser(user: SelectUser): PublicUser {
  const {
    passwordHash: _passwordHash,
    lastSeenNotificationsAt: _lastSeenNotificationsAt,
    blockedWords: _blockedWords,
    bannerImageUrl: _bannerImageUrl,
    pushPrefs: _pushPrefs,
    musicProvider: _musicProvider,
    musicId: _musicId,
    musicTitle: _musicTitle,
    musicThumbnail: _musicThumbnail,
    bannedAt: _bannedAt,
    banReason: _banReason,
    bannedBy: _bannedBy,
    ...rest
  } = user;
  return rest;
}

export const generalSettingsSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, { error: "Custom message must be at least 1 character." })
    .max(150, {
      error: "Custom message must not be longer than 150 characters.",
    }),
  bio: z
    .string()
    .trim()
    .max(150, { error: "Bio must not be longer than 150 characters." }),
  displayName: z
    .string()
    .trim()
    .max(20, { error: "Display name must not exceed 20 characters." }),
  username: z
    .string()
    .trim()
    .min(5, { error: "Username must be at least 5 characters." })
    .max(20, { error: "Username must not exceed 20 characters." })
    .refine((v) => /^[a-zA-Z0-9_-]+$/.test(v), {
      error: "Username must be alphanumeric with no spaces.",
    }),
});

const passwordSchema = z
  .string()
  .min(10, { error: "Password must be at least 10 characters" })
  .max(128, { error: "Password must not exceed 128 characters" });

export const passwordFormSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// ── post ───────────────────────────────────────────────────────────────────

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

// ── query responses ──────────────────────────────────────────────────────────

export type CursorPage<T> = {
  data: T[];
  nextCursor: string | null;
};

export type FeedResponse = CursorPage<FeedItem>;

export type PostResponse = PostData | null;

export type CommentsResponse = CursorPage<CommentData>;

// The raw note columns carrying a song attachment are replaced by a single lean
// `music` object (see resolveNoteMusic in server-lib/data.ts) so the payload
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

// One thread entry past the legacy first reply (message.reply). `fromSender`
// is the only authorship signal — reply rows never carry a user id.
export type ThreadEntry = {
  id: string;
  content: string;
  fromSender: boolean;
  createdAt: Date;
};

export type MessageThreadResponse = {
  // Role-stripped like the list payloads: the receiver's copy has senderId
  // nulled, the sender's copy has openedAt nulled; each side only sees its own
  // read watermark.
  message: MessageWithReceiver;
  replies: ThreadEntry[];
  viewerRole: "receiver" | "sender";
  // Whether the conversation can continue: the sender was signed in, so they
  // can come back to it. Exposed as a boolean because the receiver's payload
  // strips senderId (anonymity), yet the composer needs to know.
  threadable: boolean;
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
  // client. See server-lib/moderation.ts.
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
// members' polls collapse to one edge hit. null = head signal unconfigured
// (client polls the delta directly; reaction updates become eventual on reload).
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

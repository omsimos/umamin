import type { DM_REPORT_REASONS } from "./constants";

export type DmReportReason = (typeof DM_REPORT_REASONS)[number];

export interface DmReplyPreview {
  id: string;
  mine: boolean;
  /** Null when the replied-to message was unsent. */
  text: string | null;
}

/** One message as a viewer sees it. Ids are the room's seq as a string. */
export interface DmMessage {
  id: string;
  mine: boolean;
  /** Null once unsent. */
  text: string | null;
  replyTo: DmReplyPreview | null;
  myReaction: string | null;
  theirReaction: string | null;
  createdAt: number;
  /** Echoed only to the sender's own sockets, so the client can swap its
   *  optimistic bubble. */
  clientId?: string;
}

export interface DmMeta {
  peerOnline: boolean;
  /** The highest of my messages the peer has read (read receipts). */
  peerReadSeq: number;
  /** False after an unfollow: history stays readable, sending is closed. */
  canSend: boolean;
}

/** A row of the Chats list. */
export interface DmThreadItem {
  threadId: string;
  peer: {
    id: string;
    username: string;
    displayName: string | null;
    imageUrl: string | null;
  };
  /** Decrypted preview of the latest message; null when it was unsent. */
  preview: string | null;
  lastFromMe: boolean;
  lastMessageAt: number;
  unread: boolean;
}

export interface DmThreadsResponse {
  data: DmThreadItem[];
  nextCursor: string | null;
}

export interface DmUnreadResponse {
  /** Capped at DM_THREADS_PAGE_SIZE + 1; the UI shows "20+" past the cap. */
  count: number;
}

/** What /api/dm/peer/:username tells the conversation screen before the
 *  socket opens. */
export interface DmPeerResponse {
  peer: DmThreadItem["peer"];
  /** Mutual follow and no block. */
  canMessage: boolean;
  /** A conversation already exists (history to show even if canMessage is
   *  false after an unfollow). */
  hasThread: boolean;
}

export interface DmReportSnapshotEntry {
  seq: number;
  fromReporter: boolean;
  text: string | null;
  createdAt: number;
}

/** One open report in the moderator queue, with the decrypted snapshot. */
export interface DmReportItem {
  id: string;
  reason: DmReportReason;
  createdAt: number;
  reporter: { id: string; username: string } | null;
  reported: { id: string; username: string } | null;
  messageSeq: number;
  snapshot: DmReportSnapshotEntry[];
}

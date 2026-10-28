/**
 * Direct message rules as pure functions. Each op takes the rows it needs plus
 * `now` and returns what to write, with no I/O. DmRoom loads rows, persists
 * the result and broadcasts projections, so these run under plain Vitest.
 * Text here is plaintext; the room encrypts at the storage boundary.
 */
import { DM_PREVIEW_MAX, DM_REACTIONS, MAX_DM_LEN } from "./constants";
import { type DmSide, otherDmSide } from "./pair";
import type { DmErrorCode } from "./protocol";
import type { DmMessage, DmReportSnapshotEntry } from "./types";

export interface DmRow {
  seq: number;
  author: DmSide;
  /** Null once unsent. */
  text: string | null;
  replyTo: number | null;
  reactionLow: string | null;
  reactionHigh: string | null;
  createdAt: number;
}

export type NewDmRow = Omit<DmRow, "seq">;

export interface DmOpContext {
  side: DmSide;
  now: number;
  /** Mutual follow and no block, as last checked. */
  canSend: boolean;
}

export type DmOpResult =
  | { ok: false; code: DmErrorCode }
  | { ok: true; insert?: NewDmRow; update?: DmRow };

const ok = (r: { insert?: NewDmRow; update?: DmRow } = {}): DmOpResult => ({
  ok: true,
  ...r,
});
const fail = (code: DmErrorCode): DmOpResult => ({ ok: false, code });

/** Trims and validates message text; null when empty or too long. */
export function normalizeDmText(raw: string): string | null {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (text.length === 0 || text.length > MAX_DM_LEN) return null;
  return text;
}

export function send(
  ctx: DmOpContext,
  input: {
    text: string;
    /** Whether the frame named a reply target at all. */
    wantsReply: boolean;
    replyTarget: DmRow | null;
  },
): DmOpResult {
  if (!ctx.canSend) return fail("closed");
  const text = normalizeDmText(input.text);
  if (!text) return fail("invalid");
  if (input.wantsReply && !input.replyTarget) return fail("not_found");
  return ok({
    insert: {
      author: ctx.side,
      text,
      replyTo: input.replyTarget?.seq ?? null,
      reactionLow: null,
      reactionHigh: null,
      createdAt: ctx.now,
    },
  });
}

/** Sets the viewer's reaction. The same emoji again, or an empty string,
 *  clears it. */
export function react(
  ctx: DmOpContext,
  target: DmRow | null,
  emoji: string,
): DmOpResult {
  if (!ctx.canSend) return fail("closed");
  if (!target || target.text === null) return fail("not_found");
  if (emoji !== "" && !DM_REACTIONS.includes(emoji)) return fail("invalid");
  const field = ctx.side === 0 ? "reactionLow" : "reactionHigh";
  const next = emoji === "" || target[field] === emoji ? null : emoji;
  if (next === target[field]) return ok();
  return ok({ update: { ...target, [field]: next } });
}

/** Removes the text of one of the viewer's own messages. Allowed after an
 *  unfollow: taking your own words back never needs permission. */
export function unsend(ctx: DmOpContext, target: DmRow | null): DmOpResult {
  if (!target) return fail("not_found");
  if (target.author !== ctx.side) return fail("invalid");
  if (target.text === null) return ok();
  return ok({
    update: { ...target, text: null, reactionLow: null, reactionHigh: null },
  });
}

/** The new read watermark, or null when it doesn't move. Never past the
 *  newest message and never backwards. */
export function nextReadSeq(
  current: number,
  upTo: number,
  lastSeq: number,
): number | null {
  const next = Math.min(upTo, lastSeq);
  return next > current ? next : null;
}

export function projectDmMessage(
  row: DmRow,
  viewer: DmSide,
  replyTarget: DmRow | null,
  clientId?: string | null,
): DmMessage {
  const mine = row.author === viewer;
  return {
    id: String(row.seq),
    mine,
    text: row.text,
    replyTo: replyTarget
      ? {
          id: String(replyTarget.seq),
          mine: replyTarget.author === viewer,
          text: replyTarget.text,
        }
      : null,
    myReaction: viewer === 0 ? row.reactionLow : row.reactionHigh,
    theirReaction: viewer === 0 ? row.reactionHigh : row.reactionLow,
    createdAt: row.createdAt,
    ...(mine && clientId ? { clientId } : {}),
  };
}

/** Validates a report and builds its snapshot from the reported message and
 *  the rows before it (ascending). Only the other side's messages can be
 *  reported, and not once unsent. */
export function buildReportSnapshot(
  reporter: DmSide,
  target: DmRow | null,
  context: DmRow[],
):
  | { ok: false; code: DmErrorCode }
  | { ok: true; entries: DmReportSnapshotEntry[] } {
  if (!target || target.text === null) return { ok: false, code: "not_found" };
  if (target.author === reporter) return { ok: false, code: "invalid" };
  const rows = [...context.filter((r) => r.seq < target.seq), target];
  return {
    ok: true,
    entries: rows.map((r) => ({
      seq: r.seq,
      fromReporter: r.author === reporter,
      text: r.text,
      createdAt: r.createdAt,
    })),
  };
}

/** What the Turso thread row should say. The room keeps the last synced copy
 *  and compares it with the current one. */
export interface ThreadSnapshot {
  lastSeq: number;
  lastAt: number;
  lastSender: DmSide | null;
  /** Plaintext preview, already truncated; null when unsent. */
  preview: string | null;
  readSeq: [number, number];
  hiddenSeq: [number, number];
}

export function previewOf(text: string | null): string | null {
  return text === null ? null : text.slice(0, DM_PREVIEW_MAX);
}

function unreadFor(s: ThreadSnapshot, side: DmSide): boolean {
  return s.lastSender === otherDmSide(side) && s.lastSeq > s.readSeq[side];
}

function sameSnapshot(a: ThreadSnapshot, b: ThreadSnapshot): boolean {
  return (
    a.lastSeq === b.lastSeq &&
    a.lastAt === b.lastAt &&
    a.lastSender === b.lastSender &&
    a.preview === b.preview &&
    a.readSeq[0] === b.readSeq[0] &&
    a.readSeq[1] === b.readSeq[1] &&
    a.hiddenSeq[0] === b.hiddenSeq[0] &&
    a.hiddenSeq[1] === b.hiddenSeq[1]
  );
}

/**
 * How soon the thread row must be rewritten. "now" when the row doesn't exist
 * yet, when either side's unread state flips, or when a side hid the chat:
 * those change what a Chats list or badge shows. Everything else (a newer
 * message in a thread that is already unread, an unsend) waits for the
 * debounce.
 */
export function threadSyncUrgency(
  synced: ThreadSnapshot | null,
  next: ThreadSnapshot,
): "none" | "now" | "later" {
  if (!synced) return next.lastSeq > 0 ? "now" : "none";
  if (sameSnapshot(synced, next)) return "none";
  for (const side of [0, 1] as const) {
    if (unreadFor(synced, side) !== unreadFor(next, side)) return "now";
    if (synced.hiddenSeq[side] !== next.hiddenSeq[side]) return "now";
  }
  return "later";
}

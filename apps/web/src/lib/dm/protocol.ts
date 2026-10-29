/**
 * Direct message wire protocol (v1). Frames are JSON text. Client frames are
 * validated with these schemas inside DmRoom; server frames are typed only.
 * Keep a version additive: a breaking change bumps DM_PROTOCOL_VERSION, and
 * the room answers an old client with CLOSE.VERSION so it reloads.
 */
import * as z from "zod";
import { DM_REPORT_REASONS, MAX_DM_LEN } from "./constants";
import type { DmMessage, DmMeta } from "./types";

export { CLOSE, PING, PONG, parseFrame } from "../chat/protocol";

export const DM_PROTOCOL_VERSION = 1;

/** Close code for a conversation that can no longer be opened: a block, or
 *  the room was purged. Distinct from the shared codes so the UI can explain
 *  it instead of reconnecting. */
export const DM_CLOSED = 4403;

const opId = z.string().min(1).max(64);
const messageId = z.string().regex(/^\d{1,9}$/);

export const dmFrameSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hi"), v: z.number().int() }),
  z.object({
    t: z.literal("send"),
    // Also the idempotency key: a retry must reuse the original op id.
    id: opId,
    text: z.string().max(MAX_DM_LEN * 2),
    replyTo: messageId.optional(),
  }),
  z.object({
    t: z.literal("react"),
    id: opId,
    messageId,
    emoji: z.string().max(16),
  }),
  z.object({ t: z.literal("unsend"), id: opId, messageId }),
  z.object({ t: z.literal("read"), upTo: messageId }),
  z.object({ t: z.literal("typing"), on: z.boolean() }),
  z.object({ t: z.literal("history"), id: opId, before: messageId }),
  z.object({
    t: z.literal("report"),
    id: opId,
    messageId,
    reason: z.enum(DM_REPORT_REASONS),
  }),
]);
export type DmFrame = z.infer<typeof dmFrameSchema>;
export type DmOpFrame = Extract<
  DmFrame,
  { t: "send" } | { t: "react" } | { t: "unsend" }
>;

export type DmErrorCode =
  | "invalid"
  | "closed"
  | "rate_limited"
  | "not_found"
  | "reported"
  /** The room failed while handling the op; safe to retry. */
  | "unavailable";

export type DmServerFrame =
  | { t: "sync"; meta: DmMeta; messages: DmMessage[]; hasMore: boolean }
  | { t: "meta"; meta: DmMeta }
  | { t: "msgs"; messages: DmMessage[] }
  | { t: "history"; id: string; messages: DmMessage[]; hasMore: boolean }
  | { t: "typing"; on: boolean }
  /** `messageId` is set when a send stored (or had already stored) a
   *  message. */
  | { t: "ack"; id: string; messageId?: string }
  | { t: "err"; id?: string; code: DmErrorCode };

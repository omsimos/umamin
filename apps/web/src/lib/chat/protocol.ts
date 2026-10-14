/**
 * Umamin Chat wire protocol (v1). Frames are JSON text. Client frames are
 * validated with these schemas inside the Durable Objects; server frames are
 * typed only, since the client trusts its own server. Keep v1 additive: a
 * breaking change bumps PROTOCOL_VERSION, and the server answers an old client
 * with CLOSE.VERSION so it reloads the new bundle.
 */
import * as z from "zod";
import {
  MAX_ALIAS_LEN,
  MAX_AVATAR_SEED_LEN,
  MAX_INTEREST_LEN,
  MAX_INTERESTS,
  MAX_MESSAGE_LEN,
  MAX_REVEAL_HANDLE_LEN,
  MAX_SESSION_ID_LEN,
  MAX_SESSION_SECRET_LEN,
} from "./constants";
import type { ChatMessage, SnapshotMeta } from "./types";

export const PROTOCOL_VERSION = 1;

/** Keepalive text frames, answered by the runtime's auto-response so they
 *  never wake the object. Not JSON on purpose. */
export const PING = "ping";
export const PONG = "pong";

export const CLOSE = {
  NORMAL: 1000,
  BAD_FRAME: 4400,
  UNAUTHORIZED: 4401,
  GONE: 4404,
  QUEUE_TIMEOUT: 4408,
  SUPERSEDED: 4409,
  VERSION: 4426,
  TOO_MANY: 4429,
} as const;

// Raw string caps are looser than the normalized limits (trimming happens
// after parsing); they only stop oversized payloads before any work.
const sessionId = z.string().min(1).max(MAX_SESSION_ID_LEN);
const secret = z.string().min(1).max(MAX_SESSION_SECRET_LEN);
const code = z.string().max(64).optional();
const opId = z.string().min(1).max(64);
const messageId = z.string().regex(/^\d{1,9}$/);

export const lobbyFrameSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("join"),
    v: z.number().int(),
    sessionId,
    secret,
    alias: z.string().max(MAX_ALIAS_LEN * 2),
    avatarSeed: z.string().max(MAX_AVATAR_SEED_LEN * 2),
    interests: z
      .array(z.string().max(MAX_INTEREST_LEN * 2))
      .max(MAX_INTERESTS * 2),
    inviteCode: code,
    joinCode: code,
  }),
]);
export type LobbyFrame = z.infer<typeof lobbyFrameSchema>;

export const roomFrameSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("auth"),
    v: z.number().int(),
    sessionId,
    secret,
    lastSeq: z.number().int().min(0).optional(),
  }),
  z.object({
    t: z.literal("send"),
    id: opId,
    text: z.string().max(MAX_MESSAGE_LEN * 2),
    replyTo: messageId.optional(),
    whisper: z.boolean().optional(),
    effect: z.string().max(32).optional(),
  }),
  z.object({
    t: z.literal("react"),
    id: opId,
    messageId,
    emoji: z.string().max(16),
  }),
  z.object({ t: z.literal("viewWhisper"), id: opId, messageId }),
  z.object({
    t: z.literal("dealCard"),
    id: opId,
    cardId: z.string().max(64),
    mode: z.enum(["match", "guess"]).optional(),
  }),
  z.object({
    t: z.literal("answerCard"),
    id: opId,
    cardId: z.string().max(64),
    pick: z.enum(["A", "B"]),
  }),
  z.object({ t: z.literal("dismissGame"), id: opId }),
  z.object({ t: z.literal("stayConnected"), id: opId }),
  z.object({
    t: z.literal("submitReveal"),
    id: opId,
    handle: z.string().max(MAX_REVEAL_HANDLE_LEN * 2),
  }),
  z.object({ t: z.literal("withdrawReveal"), id: opId }),
  z.object({ t: z.literal("leave"), id: opId }),
  z.object({ t: z.literal("typing"), on: z.boolean() }),
]);
export type RoomFrame = z.infer<typeof roomFrameSchema>;
export type RoomOpFrame = Exclude<RoomFrame, { t: "auth" } | { t: "typing" }>;

export type ServerErrorCode =
  | "invalid"
  | "locked"
  | "not_unlocked"
  | "rate_limited"
  | "cap";

export type LobbyServerFrame =
  | { t: "waiting"; since: number }
  | { t: "matched"; matchId: string; viaInvite: boolean };

export type RoomServerFrame =
  | { t: "sync"; meta: SnapshotMeta; messages: ChatMessage[] }
  | { t: "meta"; meta: SnapshotMeta }
  | { t: "msgs"; messages: ChatMessage[] }
  | { t: "typing"; on: boolean }
  | { t: "ack"; id: string }
  | { t: "err"; id?: string; code: ServerErrorCode };

export type ServerFrame = LobbyServerFrame | RoomServerFrame;

/** Parses a client frame, rejecting oversized or malformed input. Never throws. */
export function parseFrame<T>(
  schema: z.ZodType<T>,
  raw: string | ArrayBuffer,
  maxChars: number,
): T | null {
  if (typeof raw !== "string" || raw.length > maxChars) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

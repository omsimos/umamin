import { describe, expect, it } from "vitest";
import { MAX_FRAME_CHARS, MAX_MESSAGE_LEN } from "./constants";
import {
  lobbyFrameSchema,
  PROTOCOL_VERSION,
  parseFrame,
  roomFrameSchema,
} from "./protocol";

const room = (raw: string | ArrayBuffer) =>
  parseFrame(roomFrameSchema, raw, MAX_FRAME_CHARS);
const lobby = (raw: string | ArrayBuffer) =>
  parseFrame(lobbyFrameSchema, raw, MAX_FRAME_CHARS);

const join = {
  t: "join",
  v: PROTOCOL_VERSION,
  sessionId: "sess-1",
  secret: "secret-1",
  alias: "ana",
  avatarSeed: "seed",
  interests: ["music"],
  joinCode: "abc123",
};

describe("parseFrame", () => {
  it("accepts valid auth and send frames", () => {
    const auth = {
      t: "auth",
      v: PROTOCOL_VERSION,
      sessionId: "sess-1",
      secret: "secret-1",
      lastSeq: 4,
    };
    expect(room(JSON.stringify(auth))).toEqual(auth);
    const send = { t: "send", id: "op-1", text: "hi", replyTo: "12" };
    expect(room(JSON.stringify(send))).toEqual(send);
  });

  it("accepts a valid lobby join", () => {
    expect(lobby(JSON.stringify(join))).toEqual(join);
  });

  it("drops a client-chosen inviteCode from the join frame", () => {
    const parsed = lobby(JSON.stringify({ ...join, inviteCode: "squatted" }));
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty("inviteCode");
  });

  it("rejects a frame longer than the frame cap before parsing", () => {
    const send = { t: "send", id: "op-1", text: "x".repeat(MAX_FRAME_CHARS) };
    expect(room(JSON.stringify(send))).toBeNull();
    // The same frame passes the cap check when the cap allows it, so the
    // rejection above is the length guard, not the schema.
    const small = { t: "send", id: "op-1", text: "hi" };
    const raw = JSON.stringify(small);
    expect(parseFrame(roomFrameSchema, raw, raw.length)).toEqual(small);
    expect(parseFrame(roomFrameSchema, raw, raw.length - 1)).toBeNull();
  });

  it("fits a max-length message of astral characters under the frame cap", () => {
    const text = "😀".repeat(MAX_MESSAGE_LEN);
    const frame = { t: "send", id: "op-1", text };
    expect(room(JSON.stringify(frame))?.t).toBe("send");
  });

  it("rejects malformed JSON and non-object payloads without throwing", () => {
    for (const raw of ["{not json", "", "null", "42", '"send"', "[]"]) {
      expect(room(raw), raw).toBeNull();
    }
  });

  it("rejects an unknown frame type", () => {
    expect(room(JSON.stringify({ t: "nuke", id: "op-1" }))).toBeNull();
    // A lobby frame is not a room frame.
    expect(room(JSON.stringify(join))).toBeNull();
  });

  it("rejects binary frames", () => {
    const bytes = new TextEncoder().encode(
      JSON.stringify({ t: "leave", id: "x" }),
    );
    expect(room(bytes.buffer as ArrayBuffer)).toBeNull();
  });

  it("rejects a non-numeric message id", () => {
    const frame = { t: "react", id: "op-1", messageId: "abc", emoji: "🔥" };
    expect(room(JSON.stringify(frame))).toBeNull();
    expect(room(JSON.stringify({ ...frame, messageId: "7" }))).toEqual({
      ...frame,
      messageId: "7",
    });
  });
});

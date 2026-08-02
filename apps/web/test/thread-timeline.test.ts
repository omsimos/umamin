import { describe, expect, it } from "vitest";
import type { MessageThreadResponse, ThreadEntry } from "../src/lib/types";
import { buildThreadTimeline } from "../src/routes/-inbox/thread-timeline";

const DAY_ONE = new Date("2026-07-20T10:00:00Z");
const DAY_TWO = new Date("2026-07-22T10:00:00Z");

function entry(id: string, fromSender: boolean, createdAt: Date): ThreadEntry {
  return { id, fromSender, createdAt, content: `c-${id}` };
}

function build(
  overrides: Partial<MessageThreadResponse> = {},
): MessageThreadResponse {
  return {
    message: {
      id: "m1",
      question: "q",
      content: "opening",
      reply: null,
      createdAt: DAY_ONE,
      updatedAt: null,
      receiver: {},
    },
    replies: [],
    viewerRole: "receiver",
    threadable: true,
    ...overrides,
  } as unknown as MessageThreadResponse;
}

function messages(result: ReturnType<typeof buildThreadTimeline>) {
  return result.items.filter((i) => i.kind === "message");
}

describe("buildThreadTimeline", () => {
  it("maps sides against the viewer's role, so each side sees its own writes as outgoing", () => {
    const data = build({
      message: { ...build().message, reply: "their reply" },
    });

    const asReceiver = messages(buildThreadTimeline(data));
    expect(asReceiver.map((m) => m.side)).toEqual(["incoming", "outgoing"]);

    const asSender = messages(
      buildThreadTimeline({ ...data, viewerRole: "sender" }),
    );
    expect(asSender.map((m) => m.side)).toEqual(["outgoing", "incoming"]);
  });

  it("groups a consecutive run and puts the avatar on the run's last row only", () => {
    const data = build({
      message: { ...build().message, reply: "r" },
      replies: [
        entry("a", true, DAY_ONE),
        entry("b", true, DAY_ONE),
        entry("c", true, DAY_ONE),
      ],
    });

    // Viewer is the receiver, so the three sender entries are one incoming run.
    const rows = messages(buildThreadTimeline(data));
    const run = rows.slice(-3);
    expect(run.map((m) => m.tight)).toEqual([false, true, true]);
    expect(run.map((m) => m.showAvatar)).toEqual([false, false, true]);
    expect(run.map((m) => m.endsRun)).toEqual([false, false, true]);
  });

  it("never marks an outgoing row for an avatar", () => {
    const data = build({
      message: { ...build().message, reply: "r" },
      replies: [entry("a", false, DAY_ONE)],
    });

    for (const row of messages(buildThreadTimeline(data))) {
      if (row.side === "outgoing") expect(row.showAvatar).toBe(false);
    }
  });

  it("emits a day separator only when the thread crosses a day, never before the first row", () => {
    const sameDay = buildThreadTimeline(
      build({ replies: [entry("a", true, DAY_ONE)] }),
    );
    expect(sameDay.items.some((i) => i.kind === "day")).toBe(false);

    const across = buildThreadTimeline(
      build({ replies: [entry("a", true, DAY_TWO)] }),
    );
    const days = across.items.filter((i) => i.kind === "day");
    expect(days).toHaveLength(1);
    // Never the leading item — that would separate the thread from nothing.
    expect(across.items[0].kind).toBe("message");
  });

  it("breaks the run across a day boundary even for the same side", () => {
    const rows = messages(
      buildThreadTimeline(
        build({
          replies: [entry("a", true, DAY_ONE), entry("b", true, DAY_TWO)],
        }),
      ),
    );
    expect(rows[rows.length - 1].tight).toBe(false);
  });

  it("timestamps the legacy reply only while it is the newest write", () => {
    const updatedAt = new Date("2026-07-20T11:00:00Z");
    const base = build().message;

    const alone = messages(
      buildThreadTimeline(
        build({ message: { ...base, reply: "r", updatedAt } }),
      ),
    );
    expect(alone[1].createdAt).toEqual(updatedAt);

    // Once a later entry exists, updatedAt describes that write instead.
    const withLater = messages(
      buildThreadTimeline(
        build({
          message: { ...base, reply: "r", updatedAt },
          replies: [entry("a", true, DAY_TWO)],
        }),
      ),
    );
    expect(withLater[1].createdAt).toBeNull();
  });

  it("keeps ISO wire dates usable instead of emitting invalid Dates", () => {
    const rows = messages(
      buildThreadTimeline(
        build({
          replies: [
            {
              id: "a",
              fromSender: true,
              content: "c",
              createdAt: DAY_ONE.toISOString(),
            } as unknown as ThreadEntry,
          ],
        }),
      ),
    );
    expect(rows[1].createdAt).toEqual(DAY_ONE);
  });
});

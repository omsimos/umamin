import { Experimental_EvaluationMockModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/server-lib/posthog", () => ({
  captureServerException: vi.fn(),
}));

import {
  type ClassifierAnswers,
  classifyContent,
  scoreAnswers,
} from "../src/server-lib/content-classifier";
import { contentLabel } from "../src/server-lib/content-label";
import type { AppEnv } from "../src/server-lib/env";
import { captureServerException } from "../src/server-lib/posthog";

const env = { AI_GATEWAY_API_KEY: "test-key" } as AppEnv;

function answers(
  overrides: Partial<Record<string, number>> = {},
  drama?: {
    choice: string;
    none: number;
  },
): ClassifierAnswers {
  const p = (key: string) => ({ probability: overrides[key] ?? 0.01 });
  return {
    hate: p("hate"),
    threat: p("threat"),
    doxxing: p("doxxing"),
    sexual: p("sexual"),
    encouragesSelfHarm: p("encouragesSelfHarm"),
    scam: p("scam"),
    harassment: p("harassment"),
    drama: {
      choice: drama?.choice ?? "none",
      probabilities: { none: drama?.none ?? 0.99 },
    },
    political: p("political"),
  };
}

function mockAnswers(result: ClassifierAnswers) {
  return Object.fromEntries(
    Object.entries(result).map(([id, answer]) => [
      id,
      "choice" in answer
        ? {
            type: "choice" as const,
            choice: answer.choice,
            probabilities: {
              none: answer.probabilities?.none ?? 0,
              callout: 0,
              indirect: 0,
              gossip: 0,
              fight: 1 - (answer.probabilities?.none ?? 0),
            },
          }
        : { type: "boolean" as const, probability: answer.probability },
    ]),
  );
}

function mockModel(result: ClassifierAnswers) {
  return new Experimental_EvaluationMockModelV4({
    doEvaluate: async () => ({ answers: mockAnswers(result), warnings: [] }),
  });
}

describe("scoreAnswers", () => {
  it("takes the highest severe question as the score and reason", () => {
    expect(scoreAnswers(answers({ doxxing: 0.95, harassment: 0.6 }))).toEqual({
      severe: 95,
      drama: 1,
      reason: "doxxing",
    });
  });

  it("names the new severe categories as the reason", () => {
    expect(scoreAnswers(answers({ sexual: 0.96 }))).toMatchObject({
      severe: 96,
      reason: "sexual",
    });
    expect(
      scoreAnswers(answers({ encouragesSelfHarm: 0.91, harassment: 0.7 })),
    ).toMatchObject({ severe: 91, reason: "encouragesSelfHarm" });
    expect(
      scoreAnswers(answers({ scam: 0.97, harassment: 0.4 })),
    ).toMatchObject({ severe: 97, reason: "scam" });
  });

  it("zeroes drama and harassment for political opinion but keeps hate", () => {
    const political = scoreAnswers(
      answers(
        { harassment: 0.9, political: 0.9 },
        { choice: "callout", none: 0.05 },
      ),
    );
    expect(political).toMatchObject({ drama: 0, reason: null });
    expect(political.severe).toBeLessThan(10);

    expect(scoreAnswers(answers({ hate: 0.96, political: 0.9 })).severe).toBe(
      96,
    );
  });

  it("never exempts political-sounding abuse aimed at a user's @handle", () => {
    const abuse = answers(
      { harassment: 0.9, political: 0.6 },
      { choice: "callout", none: 0.01 },
    );
    expect(
      scoreAnswers(abuse, "Ang mga DDS tulad ni @marco ay mga bobo"),
    ).toEqual({ severe: 90, drama: 99, reason: "harassment" });
    // An email address is not a mention.
    expect(
      scoreAnswers(abuse, "email mo ko sa juan@gmail.com, mga DDS").severe,
    ).toBeLessThan(10);
  });

  it("never exempts political-framed abuse in a private message", () => {
    const abuse = answers(
      { harassment: 0.9, political: 0.9 },
      { choice: "callout", none: 0.05 },
    );
    expect(scoreAnswers(abuse, "DDS ka kasi kaya bobo ka", "message")).toEqual({
      severe: 90,
      drama: 95,
      reason: "harassment",
    });
    // Posts keep the exemption.
    expect(
      scoreAnswers(abuse, "DDS ka kasi kaya bobo ka", "post").severe,
    ).toBeLessThan(10);
  });

  it("names the drama kind when nothing severe stands out", () => {
    expect(
      scoreAnswers(answers({}, { choice: "indirect", none: 0.02 })),
    ).toEqual({ severe: 1, drama: 98, reason: "indirect" });
  });
});

describe("classifyContent", () => {
  it("maps the model's answers through scoreAnswers", async () => {
    const model = mockModel(answers({ threat: 0.93 }));
    expect(
      await classifyContent(
        env,
        { kind: "post", text: "humanda ka bukas" },
        {
          model,
        },
      ),
    ).toMatchObject({ severe: 93, reason: "threat" });
  });

  it("forwards the content kind so messages get no political exemption", async () => {
    const model = mockModel(answers({ harassment: 0.9, political: 0.9 }));
    expect(
      await classifyContent(
        env,
        { kind: "message", text: "DDS ka kasi kaya bobo ka" },
        { model },
      ),
    ).toMatchObject({ severe: 90, reason: "harassment" });
  });

  it("sends the parent post apart from the author's own text", async () => {
    const doEvaluate = vi.fn(async () => ({
      answers: mockAnswers(answers()),
      warnings: [],
    }));
    const model = new Experimental_EvaluationMockModelV4({ doEvaluate });
    await classifyContent(
      env,
      { kind: "comment", text: "wag ganyan", context: "parent post" },
      { model },
    );
    const [[{ state }]] = doEvaluate.mock.calls as unknown as [
      [{ state: Record<string, unknown> }],
    ];
    expect(state).toMatchObject({
      text: "wag ganyan",
      replyingTo: "parent post",
    });
    expect(state).not.toHaveProperty("context");
  });

  it("sends a comment's thread and a message's question as their own fields", async () => {
    const doEvaluate = vi.fn(async () => ({
      answers: mockAnswers(answers()),
      warnings: [],
    }));
    const model = new Experimental_EvaluationMockModelV4({ doEvaluate });
    await classifyContent(
      env,
      {
        kind: "comment",
        text: "HAHA tama",
        context: "parent post",
        thread: ["oldest", "second", "x".repeat(300), "newest"],
      },
      { model },
    );
    await classifyContent(
      env,
      { kind: "message", text: "mataray pero mabait", question: "Ask me" },
      { model },
    );
    const [[comment], [message]] = doEvaluate.mock.calls as unknown as [
      [{ state: Record<string, string | string[]> }],
      [{ state: Record<string, string | string[]> }],
    ];
    expect(comment.state.earlierComments).toEqual([
      "second",
      "x".repeat(200),
      "newest",
    ]);
    expect(comment.state.platform).toContain('"earlierComments"');
    expect(message.state).toMatchObject({ question: "Ask me" });
    expect(message.state).not.toHaveProperty("replyingTo");
    expect(message.state.platform).toContain('"question"');
    expect(message.state.platform).not.toContain('"earlierComments"');
  });

  it("returns null without a key, so nothing is ever sent", async () => {
    expect(
      await classifyContent({} as AppEnv, { kind: "post", text: "hello" }),
    ).toBeNull();
  });

  it("skips the call for trivially short text", async () => {
    const doEvaluate = vi.fn();
    const model = new Experimental_EvaluationMockModelV4({ doEvaluate });
    expect(
      await classifyContent(env, { kind: "comment", text: " ok " }, { model }),
    ).toEqual({ severe: 0, drama: 0, reason: null });
    expect(doEvaluate).not.toHaveBeenCalled();
  });

  it("fails open on a provider error and reports it", async () => {
    const model = new Experimental_EvaluationMockModelV4({
      doEvaluate: async () => {
        throw new Error("upstream exploded");
      },
    });
    expect(
      await classifyContent(env, { kind: "note", text: "anything" }, { model }),
    ).toBeNull();
    expect(captureServerException).toHaveBeenCalled();
  });

  it("fails open quietly on a rate limit", async () => {
    vi.mocked(captureServerException).mockClear();
    const model = new Experimental_EvaluationMockModelV4({
      doEvaluate: async () => {
        throw Object.assign(new Error("Too Many Requests"), {
          statusCode: 429,
        });
      },
    });
    expect(
      await classifyContent(env, { kind: "post", text: "anything" }, { model }),
    ).toBeNull();
    expect(captureServerException).not.toHaveBeenCalled();
  });

  it("logs a gateway-wrapped timeout without reporting it or its text", async () => {
    vi.mocked(captureServerException).mockClear();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const throwing = (err: Error) =>
      new Experimental_EvaluationMockModelV4({
        doEvaluate: async () => {
          throw err;
        },
      });
    const gatewayError = (cause?: unknown) =>
      Object.assign(new Error("Gateway request failed"), {
        name: "GatewayResponseError",
        statusCode: 500,
        cause,
      });

    await classifyContent(
      env,
      { kind: "comment", text: "secret words" },
      {
        model: throwing(
          gatewayError(new DOMException("aborted", "AbortError")),
        ),
      },
    );
    expect(captureServerException).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toEqual([
      "content classification skipped",
      { kind: "comment", error: "AbortError" },
    ]);

    // The same 500 without our abort behind it is a real failure.
    vi.spyOn(console, "error").mockImplementation(() => {});
    await classifyContent(
      env,
      { kind: "comment", text: "secret words" },
      { model: throwing(gatewayError()) },
    );
    expect(captureServerException).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});

describe("contentLabel", () => {
  it("labels at the thresholds and not below", () => {
    expect(contentLabel({ modSevere: 80, modDrama: 0 }, true)).toBe("severe");
    expect(contentLabel({ modSevere: 79, modDrama: 85 }, true)).toBe("drama");
    expect(contentLabel({ modSevere: 79, modDrama: 84 }, true)).toBeNull();
  });

  it("labels covered content whose top reason is scam as a scam", () => {
    expect(
      contentLabel({ modSevere: 97, modDrama: 0, modReason: "scam" }, true),
    ).toBe("scam");
    expect(
      contentLabel({ modSevere: 97, modDrama: 0, modReason: "threat" }, true),
    ).toBe("severe");
    // Below the line the reason alone covers nothing.
    expect(
      contentLabel({ modSevere: 70, modDrama: 90, modReason: "scam" }, true),
    ).toBe("drama");
    expect(
      contentLabel({ modSevere: 70, modDrama: 0, modReason: "scam" }, true),
    ).toBeNull();
  });

  it("is off in shadow mode, for cleared rows and for unclassified rows", () => {
    expect(contentLabel({ modSevere: 99, modDrama: 99 }, false)).toBeNull();
    expect(
      contentLabel(
        { modSevere: 99, modDrama: 99, modClearedAt: new Date() },
        true,
      ),
    ).toBeNull();
    expect(contentLabel({ modSevere: null, modDrama: null }, true)).toBeNull();
  });
});

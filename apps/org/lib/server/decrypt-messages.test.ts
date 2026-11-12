import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@umamin/encryption", () => ({
  aesDecrypt: async (payload: string) => {
    if (payload === "bad") throw new Error(`cannot decrypt ${payload}`);
    return `plain:${payload}`;
  },
}));

import { decryptMessages } from "./decrypt-messages";

const createdAt = new Date("2026-11-12T08:00:00.000Z");

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe("decryptMessages", () => {
  it("decrypts every good row", async () => {
    const result = await decryptMessages([
      { id: "m-1", question: "Q", content: "one", createdAt },
      { id: "m-2", question: "Q", content: "two", createdAt },
    ]);

    expect(result).toEqual([
      {
        id: "m-1",
        question: "Q",
        content: "plain:one",
        createdAt: createdAt.getTime(),
      },
      {
        id: "m-2",
        question: "Q",
        content: "plain:two",
        createdAt: createdAt.getTime(),
      },
    ]);
    for (const item of result) {
      expect(item).not.toHaveProperty("decryptFailed");
    }
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("flags a row that can't be decrypted and keeps the rest", async () => {
    const result = await decryptMessages([
      { id: "m-1", question: "Q", content: "one", createdAt },
      { id: "m-bad", question: "Q", content: "bad", createdAt },
    ]);

    expect(result).toEqual([
      {
        id: "m-1",
        question: "Q",
        content: "plain:one",
        createdAt: createdAt.getTime(),
      },
      {
        id: "m-bad",
        question: "Q",
        content: "",
        createdAt: createdAt.getTime(),
        decryptFailed: true,
      },
    ]);
  });

  it("logs the failed ids without the payload", async () => {
    await decryptMessages([
      { id: "m-1", question: "Q", content: "one", createdAt },
      { id: "m-bad", question: "Q", content: "bad", createdAt },
    ]);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]).toContainEqual(["m-bad"]);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('"bad"');
  });
});

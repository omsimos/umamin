import { describe, expect, it } from "vitest";
import {
  getSsrExecutionContext,
  runWithSsrContext,
  type SsrExecutionContext,
} from "../src/server-lib/ssr-env";

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function ctx(label: string): SsrExecutionContext & { label: string } {
  return { label, waitUntil() {} };
}

describe("ssr-env execution context", () => {
  it("is undefined outside a request scope", () => {
    expect(getSsrExecutionContext()).toBeUndefined();
  });

  it("gives two overlapping requests their own context", async () => {
    const seen: string[] = [];

    const request = (label: string, delays: number) =>
      runWithSsrContext(ctx(label), async () => {
        for (let i = 0; i < delays; i += 1) await tick();
        const store = getSsrExecutionContext() as
          | { label?: string }
          | undefined;
        seen.push(`${label}->${store?.label}`);
      });

    // A starts first but finishes last; a module-level variable would have
    // been overwritten by B before A read it.
    await Promise.all([request("A", 3), request("B", 1)]);

    expect(seen.sort()).toEqual(["A->A", "B->B"]);
  });

  it("runs the callback directly when no context is available", async () => {
    const result = await runWithSsrContext(undefined, async () => {
      await tick();
      return getSsrExecutionContext();
    });
    expect(result).toBeUndefined();
  });
});

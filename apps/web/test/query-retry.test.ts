import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isTransientRequestError,
  queryRetryDefaults,
  shouldRetryQuery,
} from "@/lib/query-retry";
import { RequestFailedError } from "@/lib/request-error";

describe("isTransientRequestError", () => {
  it("treats each browser's network failure as transient", () => {
    for (const message of [
      "Failed to fetch",
      "Load failed",
      "NetworkError when attempting to fetch resource.",
    ]) {
      expect(isTransientRequestError(new TypeError(message))).toBe(true);
    }
  });

  it("does not treat a bug in the query function as transient", () => {
    expect(
      isTransientRequestError(
        new TypeError("Cannot read properties of undefined (reading 'id')"),
      ),
    ).toBe(false);
  });

  it("retries server failures, timeouts and rate limits only", () => {
    for (const status of [500, 502, 503, 408, 429]) {
      expect(
        isTransientRequestError(new RequestFailedError("/api/x", status)),
      ).toBe(true);
    }
    for (const status of [400, 401, 403, 404]) {
      expect(
        isTransientRequestError(new RequestFailedError("/api/x", status)),
      ).toBe(false);
    }
  });

  it("stops after two retries", () => {
    const error = new TypeError("Failed to fetch");
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(false);
  });
});

// Through a real QueryClient, because the point is that a loader's
// fetchQuery/ensureQueryData (retry:false unless a default says otherwise)
// picks the policy up from defaultOptions.
describe("loader fetches with the client defaults", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function client(isServer: boolean) {
    return new QueryClient({
      defaultOptions: { queries: queryRetryDefaults(isServer) },
    });
  }

  it("retries a dropped request inside ensureQueryData", async () => {
    const queryFn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new RequestFailedError("/api/x", 503))
      .mockResolvedValue({ ok: true });

    const result = client(false).ensureQueryData({
      queryKey: ["x"],
      queryFn,
    });
    await vi.runAllTimersAsync();

    await expect(result).resolves.toEqual({ ok: true });
    expect(queryFn).toHaveBeenCalledTimes(3);
  });

  it("fails a 404 at once", async () => {
    const queryFn = vi
      .fn()
      .mockRejectedValue(new RequestFailedError("/api/x", 404));

    const result = client(false).fetchQuery({ queryKey: ["x"], queryFn });
    const settled = expect(result).rejects.toThrow("(404)");
    await vi.runAllTimersAsync();
    await settled;

    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("never retries during SSR", async () => {
    const queryFn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const result = client(true).fetchQuery({ queryKey: ["x"], queryFn });
    const settled = expect(result).rejects.toThrow("Failed to fetch");
    await vi.runAllTimersAsync();
    await settled;

    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});

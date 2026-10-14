import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { inviteCodeFor } from "@/lib/chat/invite";
import { getSessionCredentials } from "../../session/session-id";
import { useInviteCode } from "./use-invite-code";

describe("useInviteCode", () => {
  beforeEach(() => localStorage.clear());

  // The lobby recomputes the code from the secret in the join frame, so the
  // link must carry exactly that value or deep links never land.
  it("derives the code from this browser's session secret", async () => {
    const { sessionSecret } = getSessionCredentials();
    const { result } = renderHook(() => useInviteCode());
    expect(result.current).toBeNull();
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toBe(await inviteCodeFor(sessionSecret));
  });
});

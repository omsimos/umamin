import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  markProfileFromServer,
  settleLoadedProfile,
} from "./profile-loader-cache";
import { queryKeys } from "./query";
import type { PublicUserWithBadge } from "./types";

function profile(followerCount: number) {
  return { id: "u1", username: "pal", followerCount } as PublicUserWithBadge;
}

const key = queryKeys.userProfile("pal");

describe("settleLoadedProfile", () => {
  it("replaces an earlier server response with a newer one", () => {
    const queryClient = new QueryClient();
    settleLoadedProfile(queryClient, "pal", profile(1));

    const shown = settleLoadedProfile(queryClient, "pal", profile(2));

    expect(shown.followerCount).toBe(2);
    expect(
      queryClient.getQueryData<PublicUserWithBadge>(key)?.followerCount,
    ).toBe(2);
  });

  it("replaces a response the profile query fetched itself", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, markProfileFromServer(profile(1)));

    expect(
      settleLoadedProfile(queryClient, "pal", profile(2)).followerCount,
    ).toBe(2);
  });

  it("keeps a recent patch this device made", () => {
    const queryClient = new QueryClient();
    settleLoadedProfile(queryClient, "pal", profile(1));
    // A follow on this device patches the count before the Worker cache sees it.
    queryClient.setQueryData<PublicUserWithBadge>(key, (user) =>
      user ? { ...user, followerCount: 2 } : user,
    );

    expect(
      settleLoadedProfile(queryClient, "pal", profile(1)).followerCount,
    ).toBe(2);
  });

  it("replaces an invalidated patch", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(key, profile(2));
    await queryClient.invalidateQueries({ queryKey: key });

    expect(
      settleLoadedProfile(queryClient, "pal", profile(3)).followerCount,
    ).toBe(3);
  });
});

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useIdentityDraft } from "./use-identity-draft";

describe("useIdentityDraft", () => {
  beforeEach(() => localStorage.clear());

  it("starts with a random non-empty alias", () => {
    const { result } = renderHook(() => useIdentityDraft());
    expect(result.current.alias.length).toBeGreaterThan(0);
  });

  it("toggles an interest on and off", () => {
    const { result } = renderHook(() => useIdentityDraft());
    act(() => result.current.toggleInterest("music"));
    expect(result.current.interests).toContain("music");
    expect(result.current.hasInterest("music")).toBe(true);
    act(() => result.current.toggleInterest("music"));
    expect(result.current.interests).not.toContain("music");
  });

  it("shuffle replaces the alias", () => {
    const { result } = renderHook(() => useIdentityDraft());
    act(() => result.current.setAlias("Fixed"));
    act(() => result.current.shuffle());
    expect(result.current.alias).not.toBe("Fixed");
  });

  it("persists across remounts", () => {
    const first = renderHook(() => useIdentityDraft());
    act(() => first.result.current.setAlias("KeptName"));
    act(() => first.result.current.toggleInterest("gaming"));
    const second = renderHook(() => useIdentityDraft());
    expect(second.result.current.alias).toBe("KeptName");
    expect(second.result.current.interests).toContain("gaming");
  });

  it("keeps interests when the alias is cleared to empty, across remounts", () => {
    const first = renderHook(() => useIdentityDraft());
    act(() => first.result.current.toggleInterest("gaming"));
    act(() => first.result.current.setAlias(""));
    const second = renderHook(() => useIdentityDraft());
    expect(second.result.current.alias).toBe("");
    expect(second.result.current.interests).toContain("gaming");
  });
});

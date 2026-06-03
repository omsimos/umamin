import type { SelfIdentity } from "./session/types";

const DRAFT_KEY = "umamin-chat:draft";

export function loadDraft(): SelfIdentity | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SelfIdentity>;
    if (typeof parsed.alias !== "string" || !Array.isArray(parsed.interests)) {
      return null;
    }
    return {
      alias: parsed.alias,
      avatarSeed:
        typeof parsed.avatarSeed === "string" ? parsed.avatarSeed : "",
      interests: parsed.interests.filter(
        (i): i is string => typeof i === "string",
      ),
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: SelfIdentity): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore quota / unavailable storage
  }
}

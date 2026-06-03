import { useCallback, useEffect, useState } from "react";
import { randomAlias, randomAvatarSeed } from "../alias";
import type { SelfIdentity } from "../session/types";
import { loadDraft, saveDraft } from "../storage";

const MAX_ALIAS = 20;

function initialDraft(): SelfIdentity {
  const stored = loadDraft();
  // loadDraft() returns null on missing/corrupt data, so a stored draft with a
  // deliberately blank alias is still valid — keep it (and its interests/avatar)
  // rather than wiping the draft on reload.
  if (stored) return stored;
  return {
    alias: randomAlias(),
    avatarSeed: randomAvatarSeed(),
    interests: [],
  };
}

export function useIdentityDraft() {
  const [draft, setDraft] = useState<SelfIdentity>(initialDraft);

  useEffect(() => {
    saveDraft(draft);
  }, [draft]);

  const setAlias = useCallback((alias: string) => {
    setDraft((d) => ({ ...d, alias: alias.slice(0, MAX_ALIAS) }));
  }, []);

  const shuffle = useCallback(() => {
    setDraft((d) => ({
      ...d,
      alias: randomAlias(),
      avatarSeed: randomAvatarSeed(),
    }));
  }, []);

  const toggleInterest = useCallback((id: string) => {
    setDraft((d) => ({
      ...d,
      interests: d.interests.includes(id)
        ? d.interests.filter((i) => i !== id)
        : [...d.interests, id],
    }));
  }, []);

  const hasInterest = useCallback(
    (id: string) => draft.interests.includes(id),
    [draft.interests],
  );

  return {
    alias: draft.alias,
    avatarSeed: draft.avatarSeed,
    interests: draft.interests,
    maxAlias: MAX_ALIAS,
    draft,
    setAlias,
    shuffle,
    toggleInterest,
    hasInterest,
  };
}

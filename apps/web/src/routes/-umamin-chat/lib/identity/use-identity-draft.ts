import { useEffect, useState } from "react";
import type { SelfIdentity } from "@/lib/chat/types";
import { randomAlias, randomAvatarSeed } from "../alias";
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

const NO_INTERESTS: string[] = [];

/**
 * The lobby's editable identity. It is null until mounted: the server can't
 * read localStorage and a random alias would differ between server and client,
 * so loading it during render would break hydration. `ready` gates the parts
 * of the UI that show it.
 */
export function useIdentityDraft() {
  const [draft, setDraft] = useState<SelfIdentity | null>(null);

  useEffect(() => {
    setDraft(initialDraft());
  }, []);

  useEffect(() => {
    if (draft) saveDraft(draft);
  }, [draft]);

  // State setters are stable, so these never change identity.
  const [actions] = useState(() => ({
    setAlias(alias: string) {
      setDraft((d) => d && { ...d, alias: alias.slice(0, MAX_ALIAS) });
    },
    shuffle() {
      setDraft(
        (d) =>
          d && { ...d, alias: randomAlias(), avatarSeed: randomAvatarSeed() },
      );
    },
    toggleInterest(id: string) {
      setDraft(
        (d) =>
          d && {
            ...d,
            interests: d.interests.includes(id)
              ? d.interests.filter((i) => i !== id)
              : [...d.interests, id],
          },
      );
    },
  }));

  return {
    ready: draft !== null,
    alias: draft?.alias ?? "",
    avatarSeed: draft?.avatarSeed ?? "",
    interests: draft?.interests ?? NO_INTERESTS,
    maxAlias: MAX_ALIAS,
    ...actions,
  };
}

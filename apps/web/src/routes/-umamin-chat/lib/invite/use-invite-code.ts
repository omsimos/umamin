import { useEffect, useState } from "react";
import { inviteCodeFor } from "@/lib/chat/invite";
import { getSessionCredentials } from "../../session/session-id";

/**
 * The viewer's shareable invite code, derived from their session secret the
 * same way the lobby derives it, so the link lands on them whenever they are
 * searching. Null until computed (client only), or for good where SubtleCrypto
 * is missing (insecure origins), in which case there is no link to share.
 */
export function useInviteCode(): string | null {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    inviteCodeFor(getSessionCredentials().sessionSecret).then(
      (next) => {
        if (alive) setCode(next);
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, []);

  return code;
}

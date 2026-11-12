import "server-only";

import { aesDecrypt } from "@umamin/encryption";
import type { OrgMessageItem } from "@/lib/query-types";

type StoredMessage = {
  id: string;
  question: string;
  content: string;
  createdAt: Date;
};

// A failure here almost always means the key is missing or was rotated, which
// affects every message. The dashboard must show that instead of blank cards.
export async function decryptMessages(
  rows: StoredMessage[],
): Promise<OrgMessageItem[]> {
  const failedIds: string[] = [];

  const messages = await Promise.all(
    rows.map(async (m): Promise<OrgMessageItem> => {
      const base = {
        id: m.id,
        question: m.question,
        createdAt: m.createdAt.getTime(),
      };
      try {
        return { ...base, content: await aesDecrypt(m.content) };
      } catch {
        failedIds.push(m.id);
        return { ...base, content: "", decryptFailed: true };
      }
    }),
  );

  if (failedIds.length > 0) {
    // Ids only. Never the payload or the error, which can echo it.
    console.error(
      `[messages] could not decrypt ${failedIds.length} of ${rows.length} messages`,
      failedIds,
    );
  }

  return messages;
}

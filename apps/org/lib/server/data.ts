import "server-only";

import { aesDecrypt } from "@umamin/encryption";
import { db } from "@umamin/org-db";
import { orgMessageTable } from "@umamin/org-db/schema/message";
import { orgTable } from "@umamin/org-db/schema/org";
import { and, desc, eq, lt, or } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import type {
  CurrentOrg,
  MessagesResponse,
  PublicOrg,
} from "@/lib/query-types";

// Divides evenly into the dashboard's 2/3/4-column grid.
export const MESSAGES_PAGE_SIZE = 24;
const PUBLIC_ORG_REVALIDATE_SECONDS = 60;

// Public submit page is a widely-shared link; cache the org profile lookup so
// repeat hits don't each round-trip Turso inside a function invocation. Short
// time-based TTL — staleness is purely cosmetic (whether the form shows), since
// sendMessageAction always re-reads acceptingMessages fresh from the DB.
export async function getOrgByUsername(
  username: string,
): Promise<PublicOrg | null> {
  return unstable_cache(
    async (): Promise<PublicOrg | null> => {
      const [org] = await db
        .select({
          id: orgTable.id,
          username: orgTable.username,
          displayName: orgTable.displayName,
          question: orgTable.question,
          imageUrl: orgTable.imageUrl,
          acceptingMessages: orgTable.acceptingMessages,
        })
        .from(orgTable)
        .where(eq(orgTable.username, username))
        .limit(1);

      return org ?? null;
    },
    ["org-by-username", username],
    { revalidate: PUBLIC_ORG_REVALIDATE_SECONDS },
  )();
}

export async function getCurrentOrg(orgId: string): Promise<CurrentOrg | null> {
  const [org] = await db
    .select({
      id: orgTable.id,
      username: orgTable.username,
      displayName: orgTable.displayName,
      question: orgTable.question,
      imageUrl: orgTable.imageUrl,
      acceptingMessages: orgTable.acceptingMessages,
      mustChangePassword: orgTable.mustChangePassword,
    })
    .from(orgTable)
    .where(eq(orgTable.id, orgId))
    .limit(1);

  return org ?? null;
}

function parseCursor(
  cursor?: string | null,
): { createdAt: number; id: string } | null {
  if (!cursor) return null;
  // Format: "<epochMs>_<id>" — createdAt is pure digits, so split on the first
  // "_" (a nanoid id may itself contain "_").
  const idx = cursor.indexOf("_");
  if (idx < 0) return null;
  const createdAt = Number(cursor.slice(0, idx));
  const id = cursor.slice(idx + 1);
  if (!Number.isFinite(createdAt) || !id) return null;
  return { createdAt, id };
}

async function safeDecrypt(payload: string): Promise<string> {
  try {
    return await aesDecrypt(payload);
  } catch {
    return "";
  }
}

export async function getOrgMessagesPage(params: {
  orgId: string;
  cursor?: string | null;
}): Promise<MessagesResponse> {
  const { orgId, cursor } = params;
  const c = parseCursor(cursor);

  const where = c
    ? and(
        eq(orgMessageTable.orgId, orgId),
        or(
          lt(orgMessageTable.createdAt, new Date(c.createdAt)),
          and(
            eq(orgMessageTable.createdAt, new Date(c.createdAt)),
            lt(orgMessageTable.id, c.id),
          ),
        ),
      )
    : eq(orgMessageTable.orgId, orgId);

  const rows = await db
    .select({
      id: orgMessageTable.id,
      question: orgMessageTable.question,
      content: orgMessageTable.content,
      createdAt: orgMessageTable.createdAt,
    })
    .from(orgMessageTable)
    .where(where)
    .orderBy(desc(orgMessageTable.createdAt), desc(orgMessageTable.id))
    .limit(MESSAGES_PAGE_SIZE + 1);

  const hasMore = rows.length > MESSAGES_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, MESSAGES_PAGE_SIZE) : rows;

  const messages = await Promise.all(
    page.map(async (m) => ({
      id: m.id,
      question: m.question,
      content: await safeDecrypt(m.content),
      createdAt: m.createdAt.getTime(),
    })),
  );

  const last = page.at(-1);
  const nextCursor =
    hasMore && last ? `${last.createdAt.getTime()}_${last.id}` : null;

  return { messages, nextCursor };
}

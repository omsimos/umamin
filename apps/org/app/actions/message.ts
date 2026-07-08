"use server";

import { aesEncrypt } from "@umamin/encryption";
import { db } from "@umamin/org-db";
import { orgMessageTable } from "@umamin/org-db/schema/message";
import { orgTable } from "@umamin/org-db/schema/org";
import { and, eq } from "drizzle-orm";
import { getClientIp } from "@/lib/ratelimit";
import { idSchema, sendMessageSchema } from "@/lib/schema";
import { withAction } from "@/lib/server/with-action";

export const sendMessageAction = withAction(
  {
    schema: sendMessageSchema,
    auth: "none",
    rateLimit: {
      name: "message",
      key: async () => `msg:${await getClientIp()}`,
    },
  },
  async ({ orgId, content }) => {
    // Silent success on unknown / paused org — never reveal which orgs exist.
    const [org] = await db
      .select({
        id: orgTable.id,
        question: orgTable.question,
        acceptingMessages: orgTable.acceptingMessages,
      })
      .from(orgTable)
      .where(eq(orgTable.id, orgId))
      .limit(1);

    if (!org?.acceptingMessages) {
      return { success: true };
    }

    const encrypted = await aesEncrypt(content);
    await db.insert(orgMessageTable).values({
      orgId: org.id,
      question: org.question,
      content: encrypted,
    });

    return { success: true };
  },
);

export const deleteMessageAction = withAction(
  {
    schema: idSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `delmsg:${user.id}` },
  },
  async (id, { user }) => {
    // IDOR-scoped: only the owning org can delete its own message.
    await db
      .delete(orgMessageTable)
      .where(
        and(eq(orgMessageTable.id, id), eq(orgMessageTable.orgId, user.id)),
      );
    return { success: true };
  },
);

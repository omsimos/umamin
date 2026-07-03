"use server";

import { db } from "@umamin/org-db";
import { hashPassword, verifyPassword } from "@umamin/org-db/auth";
import { orgTable } from "@umamin/org-db/schema/org";
import { eq } from "drizzle-orm";
import { passwordFormSchema, updateProfileSchema } from "@/lib/schema";
import { withAction } from "@/lib/server/with-action";
import { invalidateOrgSessions, mintSessionCookie } from "@/lib/session";

export const updatePasswordAction = withAction(
  {
    schema: passwordFormSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `pwd:${user.id}` },
  },
  async ({ currentPassword, newPassword }, { user }) => {
    // Read the hash fresh (the session user no longer carries passwordHash).
    const [row] = await db
      .select({ passwordHash: orgTable.passwordHash })
      .from(orgTable)
      .where(eq(orgTable.id, user.id))
      .limit(1);
    if (!row) {
      return { error: "Account not found" };
    }

    const valid = await verifyPassword(row.passwordHash, currentPassword);
    if (!valid) {
      return { error: "Current password is incorrect" };
    }

    const passwordHash = await hashPassword(newPassword);
    await db
      .update(orgTable)
      .set({ passwordHash, mustChangePassword: false })
      .where(eq(orgTable.id, user.id));

    // Revoke every existing session (hijack mitigation), then re-mint one for
    // the current request so the org isn't logged out by its own change.
    await invalidateOrgSessions(user.id);
    await mintSessionCookie(user.id);

    return { success: true };
  },
);

export const updateProfileAction = withAction(
  {
    schema: updateProfileSchema,
    auth: "user",
    rateLimit: { name: "write", key: ({ user }) => `profile:${user.id}` },
  },
  async ({ displayName, question, acceptingMessages }, { user }) => {
    await db
      .update(orgTable)
      .set({ displayName: displayName || null, question, acceptingMessages })
      .where(eq(orgTable.id, user.id));

    return { success: true };
  },
);

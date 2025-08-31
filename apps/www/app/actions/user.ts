"use server";

import * as z from "zod";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@umamin/db/index";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import { accountTable, userTable } from "@umamin/db/schema/user";
import { generalSettingsSchema, passwordFormSchema } from "@/types/user";
import { messageTable } from "@umamin/db/schema/message";
import { noteTable } from "@umamin/db/schema/note";
import { deleteSessionTokenCookie, invalidateSession } from "@/lib/session";

export const getCurrentUserAction = cache(async () => {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const data = await db.query.userTable.findFirst({
      where: eq(userTable.id, session.userId),
      with: {
        accounts: true,
      },
    });

    return { user: data };
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
});

export async function generalSettingsAction(
  values: z.infer<typeof generalSettingsSchema>,
) {
  try {
    const params = generalSettingsSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const data = params.data;

    await db
      .update(userTable)
      .set(data)
      .where(eq(userTable.id, session.userId));
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function deleteAccountAction() {
  const { user, session } = await getSession();

  if (!user) {
    throw new Error("Unauthorized");
  }

  try {
    await db.batch([
      db.delete(messageTable).where(eq(messageTable.receiverId, user.id)),
      db.delete(accountTable).where(eq(accountTable.userId, user.id)),
      db.delete(noteTable).where(eq(noteTable.userId, user.id)),
      db.delete(userTable).where(eq(userTable.id, user.id)),
    ]);

    await invalidateSession(session.id);
    await deleteSessionTokenCookie();
  } catch (err) {
    console.log(err);
  }

  redirect("/login");
}

export async function updatePasswordAction(
  values: z.infer<typeof passwordFormSchema>,
) {
  try {
    const { user } = await getSession();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const params = passwordFormSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { currentPassword, newPassword } = params.data;

    // if user already has a password
    if (currentPassword && user.passwordHash) {
      const validPassword = await verify(user.passwordHash, currentPassword, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });

      if (!validPassword) {
        return {
          error: "Incorrect password",
        };
      }
    }

    const passwordHash = await hash(newPassword, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    await db
      .update(userTable)
      .set({ passwordHash })
      .where(eq(userTable.id, user.id));
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function toggleDisplayPictureAction(accountImgUrl: string) {
  try {
    const { user } = await getSession();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const imageUrl = user.imageUrl ? null : accountImgUrl;

    await db
      .update(userTable)
      .set({ imageUrl })
      .where(eq(userTable.id, user.id));

    return { imageUrl };
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function toggleQuietModeAction() {
  try {
    const { user } = await getSession();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const quietMode = !user.quietMode;

    await db
      .update(userTable)
      .set({ quietMode })
      .where(eq(userTable.id, user.id));

    return { quietMode };
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

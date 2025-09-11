"use server";

import * as z from "zod";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@umamin/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import { accountTable, userTable } from "@umamin/db/schema/user";
import { generalSettingsSchema, passwordFormSchema } from "@/types/user";
import { messageTable } from "@umamin/db/schema/message";
import { noteTable } from "@umamin/db/schema/note";
import { deleteSessionTokenCookie, invalidateSession } from "@/lib/session";
import { revalidateTag, unstable_cache } from "next/cache";

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

    const { session, user } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const data = params.data;

    const oldUsername = user?.username;

    await db
      .update(userTable)
      .set(data)
      .where(eq(userTable.id, session.userId));

    // Invalidate API cache for old and new user tags
    if (oldUsername) {
      revalidateTag(`user:${oldUsername}`);
    }
    if (data.username && data.username !== oldUsername) {
      revalidateTag(`user:${data.username}`);
    }
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

    // Invalidate user's cached data by tag
    revalidateTag(`user:${user.username}`);
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

    // Invalidate user's cached data (imageUrl affects profile payload)
    revalidateTag(`user:${user.username}`);

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

    // Invalidate user's cached data (quiet mode affects profile payload)
    revalidateTag(`user:${user.username}`);

    return { quietMode };
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function getUserByUsernameAction(username: string) {
  const getCached = unstable_cache(
    async () => {
      const data = await db.query.userTable.findFirst({
        where: eq(userTable.username, username),
        columns: {
          id: true,
          username: true,
          displayName: true,
          imageUrl: true,
          bio: true,
          question: true,
          quietMode: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return data ?? null;
    },
    ["user-by-username", username],
    {
      revalidate: 86400,
      tags: [`user:${username}`],
    },
  );

  try {
    return await getCached();
  } catch (err) {
    console.log(err);
    return null;
  }
}

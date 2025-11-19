"use server";

import { hash, verify } from "@node-rs/argon2";
import { db } from "@umamin/db";
import { messageTable } from "@umamin/db/schema/message";
import { noteTable } from "@umamin/db/schema/note";
import { accountTable, userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import {
  getGravatarFinalUrl,
  getGravatarPreviewUrl,
  hashEmailForGravatar,
  normaliseEmailForGravatar,
} from "@/lib/avatar";
import { deleteSessionTokenCookie, invalidateSession } from "@/lib/session";
import { generalSettingsSchema, passwordFormSchema } from "@/types/user";

const gravatarEmailSchema = z
  .string()
  .trim()
  .min(1, { error: "Email is required" })
  .email({ error: "Invalid email address" })
  .transform((value) => normaliseEmailForGravatar(value));

export async function getGravatarAction(email: string) {
  const parsed = gravatarEmailSchema.safeParse(email);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid email address",
    };
  }

  try {
    const hash = hashEmailForGravatar(parsed.data);
    const previewUrl = getGravatarPreviewUrl(hash);

    const response = await fetch(previewUrl, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        error: "No Gravatar found for that email",
      };
    }

    return { url: getGravatarFinalUrl(hash) };
  } catch (error) {
    console.log("Error resolving Gravatar:", error);
    return { error: "Failed to reach Gravatar. Please try again later." };
  }
}

export const getCurrentUserAction = cache(async () => {
  try {
    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const [userRecord] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.id, session.userId))
      .limit(1);
    // .$withCache(false);

    const accounts = userRecord
      ? await db
          .select()
          .from(accountTable)
          .where(eq(accountTable.userId, session.userId))
      : // .$withCache(false)
        [];

    const data = userRecord ? { ...userRecord, accounts } : undefined;

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
    await db.delete(messageTable).where(eq(messageTable.receiverId, user.id));
    await db.delete(accountTable).where(eq(accountTable.userId, user.id));
    await db.delete(noteTable).where(eq(noteTable.userId, user.id));
    await db.delete(userTable).where(eq(userTable.id, user.id));

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

    // If user has an existing password, require and verify current password
    if (user.passwordHash) {
      if (!currentPassword || currentPassword.length === 0) {
        return { error: "Current password is required" };
      }

      const validPassword = await verify(user.passwordHash, currentPassword, {
        memoryCost: 19456,
        timeCost: 2,
        outputLen: 32,
        parallelism: 1,
      });

      if (!validPassword) {
        return { error: "Incorrect password" };
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

export async function toggleDisplayPictureAction(accountImgUrl?: string) {
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

export async function updateAvatarAction(imageUrl: string) {
  try {
    const { user } = await getSession();

    if (!user) {
      throw new Error("Unauthorized");
    }

    await db
      .update(userTable)
      .set({ imageUrl })
      .where(eq(userTable.id, user.id));

    revalidateTag(`user:${user.username}`);

    return { success: true };
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

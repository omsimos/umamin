"use server";

import { nanoid } from "nanoid";
import { db, eq } from "@umamin/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import {
  user as userSchema,
  account as accountSchema,
} from "@umamin/db/schema/user";
import { note as noteSchema } from "@umamin/db/schema/note";
import { message as messageSchema } from "@umamin/db/schema/message";

import { getSession, lucia } from "@/lib/auth";
import { z } from "zod";

export async function logout(): Promise<ActionResult> {
  const { session } = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  await lucia.invalidateSession(session.id);

  const sessionCookie = lucia.createBlankSessionCookie();
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );

  return redirect("/login");
}

const signupSchema = z
  .object({
    username: z
      .string()
      .min(5, {
        message: "Username must be at least 5 characters",
      })
      .max(20, {
        message: "Username must not exceed 20 characters",
      })
      .refine((url) => /^[a-zA-Z0-9_-]+$/.test(url), {
        message: "Username must be alphanumeric with no spaces",
      }),
    password: z
      .string()
      .min(5, {
        message: "Password must be at least 5 characters",
      })
      .max(255, {
        message: "Password must not exceed 255 characters",
      }),
    confirmPassword: z.string(),
  })
  .refine(
    (values) => {
      return values.password === values.confirmPassword;
    },
    {
      message: "Password does not match",
      path: ["confirmPassword"],
    }
  );

export async function signup(_: any, formData: FormData) {
  const validatedFields = signupSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const passwordHash = await hash(validatedFields.data.password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  const userId = nanoid();

  try {
    await db.insert(userSchema).values({
      id: userId,
      username: validatedFields.data.username.toLowerCase(),
      passwordHash,
    });
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT") {
      if (err.message.includes("user.username")) {
        return {
          errors: {
            username: ["Username already taken"],
          },
        };
      }
    }

    throw new Error("Something went wrong");
  }

  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);

  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );

  return redirect("/inbox");
}

export async function login(_: any, formData: FormData): Promise<ActionResult> {
  const username = formData.get("username");

  if (
    typeof username !== "string" ||
    username.length < 5 ||
    username.length > 20 ||
    !/^[a-zA-Z0-9_-]+$/.test(username)
  ) {
    return {
      error: "Incorrect username or password",
    };
  }

  const password = formData.get("password");

  if (
    typeof password !== "string" ||
    password.length < 5 ||
    password.length > 255
  ) {
    return {
      error: "Incorrect username or password",
    };
  }

  const existingUser = await db.query.user.findFirst({
    where: eq(userSchema.username, username.toLowerCase()),
  });

  if (!existingUser || !existingUser.passwordHash) {
    return {
      error: "Incorrect username or password",
    };
  }

  const validPassword = await verify(existingUser.passwordHash, password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  if (!validPassword) {
    return {
      error: "Incorrect username or password",
    };
  }

  const session = await lucia.createSession(existingUser.id, {});
  const sessionCookie = lucia.createSessionCookie(session.id);
  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes
  );

  return redirect("/inbox");
}

export async function updatePassword({
  currentPassword,
  password,
}: {
  currentPassword?: string;
  password: string;
}): Promise<ActionResult> {
  const { user } = await getSession();

  if (!user) {
    throw new Error("Unauthorized");
  }

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

  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  await db
    .update(userSchema)
    .set({ passwordHash })
    .where(eq(userSchema.id, user.id));

  return redirect("/settings");
}

export async function deleteAccount() {
  const { user } = await getSession();

  if (!user) {
    throw new Error("Unauthorized");
  }

  try {
    await db.batch([
      db.delete(messageSchema).where(eq(messageSchema.receiverId, user.id)),
      db.delete(accountSchema).where(eq(accountSchema.userId, user.id)),
      db.delete(noteSchema).where(eq(noteSchema.userId, user.id)),
      db.delete(userSchema).where(eq(userSchema.id, user.id)),
    ]);

    await lucia.invalidateSession(user.id);

    const sessionCookie = lucia.createBlankSessionCookie();
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );
  } catch (err) {
    throw new Error("Failed to delete account");
  }

  return redirect("/login");
}

interface ActionResult {
  error: string | null;
}

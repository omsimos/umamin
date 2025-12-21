"use server";

import { hash, verify } from "@node-rs/argon2";
import { db } from "@umamin/db";
import { userTable } from "@umamin/db/schema/user";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type * as z from "zod";
import { registerSchema } from "./schema";
import {
  createSession,
  deleteSessionTokenCookie,
  generateSessionToken,
  invalidateSession,
  type SessionValidationResult,
  validateSessionToken,
} from "./session";

export const getSession = cache(async (): Promise<SessionValidationResult> => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value ?? null;
  if (token === null) {
    return { session: null, user: null };
  }
  const result = await validateSessionToken(token);
  return result;
});

async function setSession(userId: string) {
  const sessionToken = generateSessionToken();
  const session = await createSession(sessionToken, userId);
  const cookieStore = await cookies();
  cookieStore.set("session", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(session.expiresAt),
    path: "/",
  });
}

export async function logout() {
  const { session } = await getSession();

  if (!session) {
    throw new Error("Unauthorized");
  }

  await invalidateSession(session.id);
  await deleteSessionTokenCookie();
  redirect("/login");
}

export async function login(_initialState: unknown, formData: FormData) {
  const username = formData.get("username");

  const normalizedUsername =
    typeof username === "string" ? username.trim().toLowerCase() : "";

  if (
    typeof username !== "string" ||
    normalizedUsername.length < 5 ||
    normalizedUsername.length > 20 ||
    !/^[a-zA-Z0-9_-]+$/.test(normalizedUsername)
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

  try {
    const [existingUser] = await db
      .select()
      .from(userTable)
      .where(eq(userTable.username, normalizedUsername))
      .limit(1);

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

    await setSession(existingUser.id);
  } catch (err) {
    console.error("Login error:", err);
    return {
      error: "An unexpected error occurred",
    };
  }

  redirect("/inbox");
}

export async function signup(data: z.infer<typeof registerSchema>) {
  const validatedFields = registerSchema.safeParse({
    ...data,
    username: data.username?.trim().toLowerCase(),
  });

  if (!validatedFields.success) {
    return {
      error: "Invalid input",
    };
  }

  const passwordHash = await hash(validatedFields.data.password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  let userId = "";

  try {
    const res = await db
      .insert(userTable)
      .values({
        username: validatedFields.data.username.toLowerCase(),
        passwordHash,
      })
      .returning({ id: userTable.id });

    userId = res[0].id;
    await setSession(userId);
  } catch (err) {
    console.log(err);

    if (
      err instanceof Error &&
      typeof err.cause === "object" &&
      err.cause !== null
    ) {
      const cause = err.cause as { code?: string; message?: string };

      if (
        cause.code === "SQLITE_CONSTRAINT" &&
        cause.message?.includes("user.username")
      ) {
        return {
          error: "Username already exists",
        };
      }
    }

    return {
      error: "An unexpected error occurred",
    };
  }

  redirect("/inbox");
}

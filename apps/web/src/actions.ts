"use server";

import { nanoid } from "nanoid";
import { db, eq } from "@umamin/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import { user as userSchema } from "@umamin/db/schema/user";

import { getSession, lucia } from "./lib/auth";

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
    sessionCookie.attributes,
  );

  return redirect("/login");
}

export async function signup({
  username,
  password,
}: {
  username: string;
  password: string;
}): Promise<ActionResult> {
  if (
    typeof username !== "string" ||
    username.length < 5 ||
    username.length > 20 ||
    !/^[a-z0-9_-]+$/.test(username)
  ) {
    return {
      error: "Username must be alphanumeric with no spaces",
    };
  }

  if (
    typeof password !== "string" ||
    password.length < 5 ||
    password.length > 255
  ) {
    return {
      error: "Password must be at least 5 characters long",
    };
  }

  const passwordHash = await hash(password, {
    memoryCost: 19456,
    timeCost: 2,
    outputLen: 32,
    parallelism: 1,
  });

  const userId = nanoid();

  await db.insert(userSchema).values({
    id: userId,
    username,
    passwordHash,
  });

  const session = await lucia.createSession(userId, {});
  const sessionCookie = lucia.createSessionCookie(session.id);

  cookies().set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.attributes,
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
    sessionCookie.attributes,
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

interface ActionResult {
  error: string | null;
}

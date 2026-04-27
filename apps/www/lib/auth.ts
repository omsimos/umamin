"use server";

import type { SessionValidationResult } from "@umamin/core/session";
import { redirect } from "next/navigation";
import type * as z from "zod";
import { apiFetch, apiJson, jsonBody } from "./api";
import type { registerSchema } from "./schema";

export async function getSession(): Promise<SessionValidationResult> {
  return apiJson<SessionValidationResult>("/api/auth/session");
}

export async function logout() {
  const response = await apiFetch("/api/auth/logout", { method: "POST" });

  if (!response.ok) {
    throw new Error("Unauthorized");
  }

  redirect("/login");
}

export async function login(_initialState: unknown, formData: FormData) {
  const response = await apiFetch("/api/auth/login", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return { error: result?.error ?? "An unexpected error occurred" };
  }

  redirect("/inbox");
}

export async function signup(data: z.infer<typeof registerSchema>) {
  const response = await apiFetch("/api/auth/signup", {
    method: "POST",
    body: jsonBody(data),
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return { error: result?.error ?? "An unexpected error occurred" };
  }

  redirect("/inbox");
}

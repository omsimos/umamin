"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { apiFetch, apiJson, jsonBody } from "@/lib/api";
import {
  getGravatarFinalUrl,
  getGravatarPreviewUrl,
  hashEmailForGravatar,
  normaliseEmailForGravatar,
} from "@/lib/avatar";
import { getCurrentUserData, getUserProfileData } from "@/lib/server/data";
import type { generalSettingsSchema, passwordFormSchema } from "@/types/user";

const gravatarEmailSchema = z
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
      return { error: "No Gravatar found for that email" };
    }

    return { url: getGravatarFinalUrl(hash) };
  } catch (error) {
    console.log("Error resolving Gravatar:", error);
    return { error: "Failed to reach Gravatar. Please try again later." };
  }
}

export async function getCurrentUserAction() {
  try {
    return getCurrentUserData("current");
  } catch (err) {
    console.log(err);
    return { error: "An error occured" };
  }
}

export async function getUserProfileAction(username: string) {
  try {
    return getUserProfileData(username, "current");
  } catch (err) {
    console.log(err);
    return null;
  }
}

export async function generalSettingsAction(
  values: z.infer<typeof generalSettingsSchema>,
) {
  return apiJson("/api/settings/general", {
    method: "PATCH",
    body: jsonBody(values),
  }).catch((error) => ({ error: error.message ?? "An error occured" }));
}

export async function deleteAccountAction() {
  await apiFetch("/api/account", { method: "DELETE" });
  redirect("/login");
}

export async function updatePasswordAction(
  values: z.infer<typeof passwordFormSchema>,
) {
  return apiJson("/api/settings/password", {
    method: "PATCH",
    body: jsonBody(values),
  }).catch((error) => ({ error: error.message ?? "An error occured" }));
}

export async function followUserAction({ userId }: { userId: string }) {
  return apiJson(`/api/users/${userId}/follow`, { method: "POST" }).catch(
    (error) => ({ error: error.message ?? "An error occured" }),
  );
}

export async function unfollowUserAction({ userId }: { userId: string }) {
  return apiJson(`/api/users/${userId}/follow`, { method: "DELETE" }).catch(
    (error) => ({ error: error.message ?? "An error occured" }),
  );
}

export async function blockUserAction({ userId }: { userId: string }) {
  return apiJson(`/api/users/${userId}/block`, { method: "POST" }).catch(
    (error) => ({ error: error.message ?? "An error occured" }),
  );
}

export async function unblockUserAction({ userId }: { userId: string }) {
  return apiJson(`/api/users/${userId}/block`, { method: "DELETE" }).catch(
    (error) => ({ error: error.message ?? "An error occured" }),
  );
}

export async function toggleDisplayPictureAction(accountImgUrl?: string) {
  return apiJson("/api/settings/display-picture", {
    method: "PATCH",
    body: jsonBody({ accountImgUrl }),
  }).catch((error) => ({ error: error.message ?? "An error occured" }));
}

export async function toggleQuietModeAction() {
  return apiJson("/api/settings/quiet-mode", { method: "PATCH" }).catch(
    (error) => ({ error: error.message ?? "An error occured" }),
  );
}

export async function updateAvatarAction(imageUrl: string) {
  return apiJson("/api/settings/avatar", {
    method: "PATCH",
    body: jsonBody({ imageUrl }),
  }).catch((error) => ({ error: error.message ?? "An error occured" }));
}

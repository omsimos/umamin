"use server";

import * as z from "zod";
import { getSession } from "@/lib/auth";
import {
  AVATAR_MAX_BYTES,
  MAX_IMAGE_BYTES,
  MAX_POST_IMAGES,
  PLUS_REQUIRED_ERROR,
  UPLOAD_CONTENT_TYPES,
} from "@/lib/post-images";
import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/ratelimit";
import {
  isR2Configured,
  newStagingKey,
  presignImagePut,
} from "@/lib/server/r2";
import { hasUmaminPlus } from "@/lib/utils";

const presignSchema = z.object({
  images: z
    .array(
      z.object({
        contentType: z.enum(UPLOAD_CONTENT_TYPES),
        contentLength: z.number().int().min(1).max(MAX_IMAGE_BYTES),
      }),
    )
    .min(1)
    .max(MAX_POST_IMAGES),
});

/**
 * Mints presigned PUT URLs for direct browser→R2 uploads (file bytes never
 * touch the server). Each URL is pinned to the approved type + exact byte
 * count and targets a per-user staging key; createPostAction later claims the
 * staged objects. Umamin+ only — re-checked here since the composer gate is
 * UX-only.
 */
export async function presignPostImagesAction(
  values: z.infer<typeof presignSchema>,
) {
  try {
    const params = presignSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { session, user } = await getSession();

    if (!session || !user) {
      throw new Error("Unauthorized");
    }

    if (!isR2Configured()) {
      return { error: "Image uploads aren't available right now." };
    }

    if (!hasUmaminPlus(user.createdAt)) {
      return { error: PLUS_REQUIRED_ERROR };
    }

    if (!(await checkRateLimit("write", `imgup:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const uploads = await Promise.all(
      params.data.images.map(async (image) => {
        const key = newStagingKey(session.userId, image.contentType);
        const url = await presignImagePut({
          key,
          contentType: image.contentType,
          contentLength: image.contentLength,
        });
        return url ? { key, url } : null;
      }),
    );

    if (uploads.some((upload) => upload === null)) {
      return { error: "An error occurred" };
    }

    return { success: true, uploads: uploads.filter((u) => u !== null) };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

const presignAvatarSchema = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  contentLength: z.number().int().min(1).max(AVATAR_MAX_BYTES),
});

/**
 * Presigned PUT for a profile photo. Same staging flow as post images but
 * available to every signed-in user (not Umamin+ gated) with a much smaller
 * size cap; updateProfilePhotoAction claims the staged object.
 */
export async function presignAvatarUploadAction(
  values: z.infer<typeof presignAvatarSchema>,
) {
  try {
    const params = presignAvatarSchema.safeParse(values);

    if (!params.success) {
      return { error: "Invalid input" };
    }

    const { session } = await getSession();

    if (!session) {
      throw new Error("Unauthorized");
    }

    if (!isR2Configured()) {
      return { error: "Photo uploads aren't available right now." };
    }

    if (!(await checkRateLimit("write", `avatarup:${session.userId}`))) {
      return { error: RATE_LIMIT_ERROR };
    }

    const key = newStagingKey(session.userId, params.data.contentType);
    const url = await presignImagePut({
      key,
      contentType: params.data.contentType,
      contentLength: params.data.contentLength,
    });

    if (!url) {
      return { error: "An error occurred" };
    }

    return { success: true, key, url };
  } catch (err) {
    console.log(err);
    return { error: "An error occurred" };
  }
}

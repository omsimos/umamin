"use server";

import * as z from "zod";
import {
  AVATAR_MAX_BYTES,
  MAX_IMAGE_BYTES,
  MAX_POST_IMAGES,
  PLUS_REQUIRED_ERROR,
  UPLOAD_CONTENT_TYPES,
} from "@/lib/post-images";
import {
  isR2Configured,
  newStagingKey,
  presignImagePut,
} from "@/lib/server/r2";
import { withAction } from "@/lib/server/with-action";
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
export const presignPostImagesAction = withAction(
  {
    schema: presignSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `imgup:${session.userId}`,
    },
  },
  async ({ images }, { session, user }) => {
    if (!isR2Configured()) {
      return { error: "Image uploads aren't available right now." };
    }

    if (!hasUmaminPlus(user.createdAt)) {
      return { error: PLUS_REQUIRED_ERROR };
    }

    const uploads = await Promise.all(
      images.map(async (image) => {
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
  },
);

const presignAvatarSchema = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  contentLength: z.number().int().min(1).max(AVATAR_MAX_BYTES),
});

/**
 * Presigned PUT for a profile photo. Same staging flow as post images but
 * available to every signed-in user (not Umamin+ gated) with a much smaller
 * size cap; updateProfilePhotoAction claims the staged object.
 */
export const presignAvatarUploadAction = withAction(
  {
    schema: presignAvatarSchema,
    rateLimit: {
      name: "write",
      key: ({ session }) => `avatarup:${session.userId}`,
    },
  },
  async ({ contentType, contentLength }, { session }) => {
    if (!isR2Configured()) {
      return { error: "Photo uploads aren't available right now." };
    }

    const key = newStagingKey(session.userId, contentType);
    const url = await presignImagePut({
      key,
      contentType,
      contentLength,
    });

    if (!url) {
      return { error: "An error occurred" };
    }

    return { success: true, key, url };
  },
);

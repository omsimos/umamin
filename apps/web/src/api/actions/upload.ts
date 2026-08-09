import * as z from "zod";
import {
  AVATAR_MAX_BYTES,
  BANNER_MAX_BYTES,
  canPostImages,
  IMAGE_AURA_REQUIRED_ERROR,
  MAX_IMAGE_BYTES,
  MAX_POST_IMAGES,
  UPLOAD_CONTENT_TYPES,
} from "../../lib/post-images";
import { action } from "../../server-lib/action";
import { createR2, newStagingKey } from "../../server-lib/r2";

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

export const presignPostImagesHandler = action(
  {
    schema: presignSchema,
    auth: "user",
    rateLimit: {
      name: "write",
      key: ({ session }) => `imgup:${session.userId}`,
    },
  },
  async ({ images }, { session, user, c }) => {
    const r2 = createR2(c.env);
    if (!r2) {
      return { error: "Image uploads aren't available right now." };
    }

    if (!canPostImages(user)) {
      return { error: IMAGE_AURA_REQUIRED_ERROR };
    }

    const uploads = await Promise.all(
      images.map(async (image) => {
        const key = newStagingKey(session.userId, image.contentType);
        const url = await r2.presignImagePut({
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

export const presignAvatarUploadHandler = action(
  {
    schema: presignAvatarSchema,
    rateLimit: {
      name: "write",
      key: ({ session }) => `avatarup:${session.userId}`,
    },
  },
  async ({ contentType, contentLength }, { session, c }) => {
    const r2 = createR2(c.env);
    if (!r2) {
      return { error: "Photo uploads aren't available right now." };
    }

    const key = newStagingKey(session.userId, contentType);
    const url = await r2.presignImagePut({ key, contentType, contentLength });

    if (!url) {
      return { error: "An error occurred" };
    }

    return { success: true, key, url };
  },
);

const presignBannerSchema = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
  contentLength: z.number().int().min(1).max(BANNER_MAX_BYTES),
});

export const presignBannerUploadHandler = action(
  {
    schema: presignBannerSchema,
    rateLimit: {
      name: "write",
      key: ({ session }) => `bannerup:${session.userId}`,
    },
  },
  async ({ contentType, contentLength }, { session, c }) => {
    const r2 = createR2(c.env);
    if (!r2) {
      return { error: "Banner uploads aren't available right now." };
    }

    const key = newStagingKey(session.userId, contentType);
    const url = await r2.presignImagePut({ key, contentType, contentLength });

    if (!url) {
      return { error: "An error occurred" };
    }

    return { success: true, key, url };
  },
);

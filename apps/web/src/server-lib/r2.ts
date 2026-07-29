import type { PostImage } from "@umamin/db/schema/post";
import { AwsClient, AwsV4Signer } from "aws4fetch";
import { nanoid } from "nanoid";
import {
  AVATAR_MAX_BYTES,
  BANNER_MAX_BYTES,
  imageExtension,
  isOwnStagingKey,
  MAX_IMAGE_BYTES,
  type PostImageInput,
  r2KeyFromPublicUrl,
  type UploadContentType,
} from "../lib/post-images";
import type { AppEnv } from "./env";

// R2 presign + object-lifecycle (ported from apps/www/lib/server/r2.ts). The
// module-init `process.env` reads + singleton AwsClient are replaced by a
// per-call factory (`createR2(env)`) so config comes from the request `env`
// (Workers "explicit deps" rule). Returns null when R2 isn't configured so
// every caller degrades to a no-op, exactly like apps/www.

const PRESIGN_EXPIRES_SECONDS = 600;
const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

// R2 credentials have fixed widths (32-char access key id, 64-char secret).
// Presigning with the two swapped still returns a URL, and R2 rejects the PUT
// with a CORS-header-less 400 ("Credential access key has length 64, should be
// 32") — which reaches the browser as an unexplained CORS failure. Check the
// shape here so a mis-entered secret shows up as a log line instead.
const ACCESS_KEY_ID_LENGTH = 32;
const SECRET_ACCESS_KEY_LENGTH = 64;

// ── pure sniff/parse helpers (no config) ─────────────────────────────────────

export function sniffImageType(bytes: Uint8Array): UploadContentType | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

// "bytes 0-15/123456" -> 123456
export function parseContentRangeTotal(header: string | null): number | null {
  const total = header?.split("/")[1];
  if (!total || total === "*") return null;
  const parsed = Number(total);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function newStagingKey(userId: string, contentType: UploadContentType) {
  return `staging/${userId}/${nanoid()}.${imageExtension(contentType)}`;
}

export type R2Client = ReturnType<typeof createR2> & object;

/**
 * Builds an R2 client bound to the request env, or null when R2 isn't
 * configured (mirrors apps/www's `configured` gate — every method no-ops via
 * the null return at the call site).
 */
export function createR2(env: AppEnv) {
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET ||
    !env.R2_PUBLIC_URL
  ) {
    return null;
  }

  if (
    env.R2_ACCESS_KEY_ID.length !== ACCESS_KEY_ID_LENGTH ||
    env.R2_SECRET_ACCESS_KEY.length !== SECRET_ACCESS_KEY_LENGTH
  ) {
    console.error(
      `[r2] refusing to presign with malformed credentials: R2_ACCESS_KEY_ID must be ${ACCESS_KEY_ID_LENGTH} chars (got ${env.R2_ACCESS_KEY_ID.length}) and R2_SECRET_ACCESS_KEY ${SECRET_ACCESS_KEY_LENGTH} (got ${env.R2_SECRET_ACCESS_KEY.length}) — check for a swapped pair`,
    );
    return null;
  }

  // Narrowed to string (the guard above), re-bound to plain consts so the nested
  // closures below see `string`, not `string | undefined` (control-flow
  // narrowing doesn't flow into closures).
  const accountId: string = env.R2_ACCOUNT_ID;
  const accessKeyId: string = env.R2_ACCESS_KEY_ID;
  const secretAccessKey: string = env.R2_SECRET_ACCESS_KEY;
  const bucket: string = env.R2_BUCKET;
  const publicUrl: string = env.R2_PUBLIC_URL;

  const r2 = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });

  // Keys are nanoid + fixed prefixes (URL-safe already); encode defensively.
  function objectUrl(key: string) {
    const encoded = key.split("/").map(encodeURIComponent).join("/");
    return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${encoded}`;
  }

  /**
   * Presigned PUT pinned to the exact Content-Type AND Content-Length the
   * presign action approved — a different body size or type fails the SigV4
   * signature at R2, so a client can't swap in a bigger upload. AwsV4Signer is
   * used directly (not AwsClient.sign) because a `new Request()` would strip
   * the forbidden Content-Length header before signing, and `allHeaders` is
   * required since aws4fetch treats content-length as unsignable by default.
   */
  async function presignImagePut(params: {
    key: string;
    contentType: UploadContentType;
    contentLength: number;
  }) {
    const signer = new AwsV4Signer({
      method: "PUT",
      url: `${objectUrl(params.key)}?X-Amz-Expires=${PRESIGN_EXPIRES_SECONDS}`,
      headers: {
        "Content-Type": params.contentType,
        "Content-Length": String(params.contentLength),
      },
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
      signQuery: true,
      allHeaders: true,
    });

    const { url } = await signer.sign();
    return url.toString();
  }

  /**
   * One ranged GET answers everything about a staged object: it exists, its
   * TRUE total size (Content-Range — authoritative even if the signed-length
   * enforcement were ever bypassed), and its real magic bytes (the signed
   * Content-Type header only constrains the label, not the body).
   */
  async function validateStagedImage(
    key: string,
    maxBytes: number,
  ): Promise<{ contentType: UploadContentType } | null> {
    try {
      const res = await r2.fetch(objectUrl(key), {
        headers: { Range: "bytes=0-15" },
      });

      if (!res.ok) {
        await res.body?.cancel();
        return null;
      }

      const total = parseContentRangeTotal(res.headers.get("content-range"));
      const bytes = new Uint8Array(await res.arrayBuffer());
      const contentType = sniffImageType(bytes);

      if (!contentType || total === null || total < 32 || total > maxBytes) {
        return null;
      }

      return { contentType };
    } catch (err) {
      console.error("[r2] validateStagedImage failed", err);
      return null;
    }
  }

  async function copyObject(
    srcKey: string,
    dstKey: string,
    contentType: UploadContentType,
  ) {
    const encodedSource = `/${bucket}/${srcKey
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    const res = await r2.fetch(objectUrl(dstKey), {
      method: "PUT",
      headers: {
        "x-amz-copy-source": encodedSource,
        // REPLACE so the permanent object gets the long-lived immutable cache
        // policy (keys are content-unique, never rewritten) + verified type.
        "x-amz-metadata-directive": "REPLACE",
        "Content-Type": contentType,
        "Cache-Control": IMMUTABLE_CACHE_CONTROL,
      },
    });

    await res.body?.cancel();
    return res.ok;
  }

  async function deleteObject(key: string) {
    const res = await r2.fetch(objectUrl(key), { method: "DELETE" });
    await res.body?.cancel();
  }

  /**
   * Best-effort cleanup when a post is deleted (or claim rolls back). Restricted
   * to the posts/ prefix so a corrupted key can never delete anything else.
   */
  async function deletePostImages(
    images: Pick<PostImage, "key">[] | null | undefined,
  ) {
    if (!images?.length) return;

    await Promise.all(
      images.map(async (image) => {
        if (!image.key.startsWith("posts/")) return;
        try {
          await deleteObject(image.key);
        } catch (err) {
          console.error("[r2] deletePostImages failed", err);
        }
      }),
    );
  }

  /**
   * Moves staged uploads to the permanent posts/ prefix. All-or-nothing: any
   * invalid/missing image rolls back the copies and the post isn't created.
   */
  async function claimStagedImages(
    userId: string,
    images: PostImageInput[],
  ): Promise<PostImage[] | null> {
    const claimed = await Promise.all(
      images.map(async (image): Promise<PostImage | null> => {
        if (!isOwnStagingKey(image.key, userId)) return null;

        const meta = await validateStagedImage(image.key, MAX_IMAGE_BYTES);
        if (!meta) return null;

        const finalKey = `posts/${userId}/${nanoid()}.${imageExtension(meta.contentType)}`;
        const copied = await copyObject(image.key, finalKey, meta.contentType);
        if (!copied) return null;

        deleteObject(image.key).catch(() => {});

        return {
          key: finalKey,
          width: image.width,
          height: image.height,
        };
      }),
    );

    const successful = claimed.filter((image) => image !== null);

    if (successful.length !== images.length) {
      await deletePostImages(successful);
      return null;
    }

    return successful;
  }

  /**
   * Claims a staged avatar upload: validates, copies to the permanent avatars/
   * prefix, and returns the final key (null on any failure).
   */
  async function claimStagedAvatar(
    userId: string,
    key: string,
  ): Promise<string | null> {
    if (!isOwnStagingKey(key, userId)) return null;

    const meta = await validateStagedImage(key, AVATAR_MAX_BYTES);
    if (!meta) return null;

    const finalKey = `avatars/${userId}/${nanoid()}.${imageExtension(meta.contentType)}`;
    const copied = await copyObject(key, finalKey, meta.contentType);
    if (!copied) return null;

    deleteObject(key).catch(() => {});

    return finalKey;
  }

  /**
   * Claims a staged banner upload: validates, copies to the permanent banners/
   * prefix, and returns the final key (null on any failure).
   */
  async function claimStagedBanner(
    userId: string,
    key: string,
  ): Promise<string | null> {
    if (!isOwnStagingKey(key, userId)) return null;

    const meta = await validateStagedImage(key, BANNER_MAX_BYTES);
    if (!meta) return null;

    const finalKey = `banners/${userId}/${nanoid()}.${imageExtension(meta.contentType)}`;
    const copied = await copyObject(key, finalKey, meta.contentType);
    if (!copied) return null;

    deleteObject(key).catch(() => {});

    return finalKey;
  }

  /**
   * Best-effort delete of a replaced/hidden profile photo. Only acts on URLs
   * that resolve to our own avatars/ prefix — Google photo URLs (and any other
   * host) pass through untouched.
   */
  async function deleteR2Avatar(imageUrl: string | null | undefined) {
    const key = r2KeyFromPublicUrl(publicUrl, imageUrl);
    if (!key?.startsWith("avatars/")) return;

    try {
      await deleteObject(key);
    } catch (err) {
      console.error("[r2] deleteR2Avatar failed", err);
    }
  }

  /**
   * Best-effort delete of a replaced/removed banner. Only acts on URLs that
   * resolve to our own banners/ prefix.
   */
  async function deleteR2Banner(imageUrl: string | null | undefined) {
    const key = r2KeyFromPublicUrl(publicUrl, imageUrl);
    if (!key?.startsWith("banners/")) return;

    try {
      await deleteObject(key);
    } catch (err) {
      console.error("[r2] deleteR2Banner failed", err);
    }
  }

  return {
    presignImagePut,
    claimStagedImages,
    deletePostImages,
    claimStagedAvatar,
    deleteR2Avatar,
    claimStagedBanner,
    deleteR2Banner,
  };
}

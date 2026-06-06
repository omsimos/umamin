import { useRef, useState } from "react";
import { toast } from "sonner";
import { presignPostImagesAction } from "@/app/actions/upload";
import {
  type CompressedImage,
  compressImage,
  ImageCompressError,
} from "@/lib/image-compress";
import { MAX_POST_IMAGES, type PostImageInput } from "@/lib/post-images";

export type ImageAttachment = {
  id: string;
  status: "processing" | "uploading" | "ready" | "error";
  /** Upload progress, 0..1 (only meaningful while uploading). */
  progress: number;
  previewUrl: string;
  width: number;
  height: number;
  error?: string;
  key?: string;
};

type AttachmentMeta = {
  file: File;
  compressed?: CompressedImage;
  xhr?: XMLHttpRequest;
};

function putWithProgress(params: {
  url: string;
  blob: Blob;
  contentType: string;
  onProgress: (fraction: number) => void;
  onStart: (xhr: XMLHttpRequest) => void;
}) {
  // XHR, not fetch: request-body progress events still aren't portably
  // available on fetch in 2026, and XHR gives a real abort() for removal.
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", params.url);
    // Must match the presigned signature exactly or R2 rejects with 403.
    xhr.setRequestHeader("Content-Type", params.contentType);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        params.onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error("Upload failed. Please try again."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed. Please try again."));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

    params.onStart(xhr);
    xhr.send(params.blob);
  });
}

/**
 * Composer image attachments: compression + upload start the moment a file
 * is attached (preview renders instantly from a local object URL), so
 * hitting Post is near-instant. Compression runs one image at a time to
 * respect mobile canvas memory budgets; uploads overlap freely.
 */
export function useImageAttachments() {
  const [items, setItems] = useState<ImageAttachment[]>([]);
  const metaRef = useRef(new Map<string, AttachmentMeta>());
  const compressQueue = useRef<Promise<unknown>>(Promise.resolve());

  const patchItem = (id: string, patch: Partial<ImageAttachment>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const isRemoved = (id: string) => !metaRef.current.has(id);

  const process = async (id: string) => {
    const meta = metaRef.current.get(id);
    if (!meta) return;

    try {
      // Reuse the compressed blob on retry; only the first run compresses.
      if (!meta.compressed) {
        const task = () => compressImage(meta.file);
        const run = compressQueue.current.then(task, task);
        compressQueue.current = run.then(
          () => undefined,
          () => undefined,
        );
        meta.compressed = await run;
      }

      if (isRemoved(id)) return;

      const { blob, contentType, width, height } = meta.compressed;

      // Re-point the preview at the compressed blob (~300KB) so the original
      // multi-MB camera file can be released instead of staying pinned for as
      // long as the preview lives. Also makes the preview show exactly what
      // was uploaded.
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          URL.revokeObjectURL(item.previewUrl);
          return {
            ...item,
            status: "uploading",
            progress: 0,
            width,
            height,
            previewUrl: URL.createObjectURL(blob),
          };
        }),
      );

      const res = await presignPostImagesAction({
        images: [{ contentType, contentLength: blob.size }],
      });

      if (res.error || !res.uploads?.[0]) {
        throw new Error(res.error ?? "Upload failed. Please try again.");
      }

      if (isRemoved(id)) return;

      const { key, url } = res.uploads[0];

      await putWithProgress({
        url,
        blob,
        contentType,
        onProgress: (fraction) => patchItem(id, { progress: fraction }),
        onStart: (xhr) => {
          meta.xhr = xhr;
          // Removal can land between the presign response and send().
          if (isRemoved(id)) xhr.abort();
        },
      });

      meta.xhr = undefined;
      if (isRemoved(id)) return;

      patchItem(id, { status: "ready", progress: 1, key });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (isRemoved(id)) return;

      patchItem(id, {
        status: "error",
        error:
          err instanceof ImageCompressError || err instanceof Error
            ? err.message
            : "Something went wrong.",
      });
    }
  };

  const addFiles = (files: Iterable<File>) => {
    const images = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (images.length === 0) return;

    // metaRef updates synchronously, so two attach paths firing in the same
    // task (paste + drop) can't both see the same free-slot count the way the
    // async `items` state could.
    const slots = MAX_POST_IMAGES - metaRef.current.size;
    if (slots <= 0 || images.length > slots) {
      toast.error(`You can attach up to ${MAX_POST_IMAGES} images.`);
      if (slots <= 0) return;
    }

    const accepted = images.slice(0, slots).map((file) => {
      const id = crypto.randomUUID();
      metaRef.current.set(id, { file });
      return {
        id,
        status: "processing" as const,
        progress: 0,
        previewUrl: URL.createObjectURL(file),
        width: 0,
        height: 0,
      };
    });

    setItems((prev) => [...prev, ...accepted]);

    for (const item of accepted) {
      void process(item.id);
    }
  };

  const remove = (id: string) => {
    const meta = metaRef.current.get(id);
    meta?.xhr?.abort();
    metaRef.current.delete(id);

    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
    // An already-uploaded staging object just expires via the bucket
    // lifecycle rule — no delete round-trip needed.
  };

  const retry = (id: string) => {
    if (isRemoved(id)) return;
    patchItem(id, { status: "processing", progress: 0, error: undefined });
    void process(id);
  };

  // Object URLs are intentionally NOT revoked here: the optimistic feed item
  // keeps rendering them until the server row takes over.
  const resetAfterPost = () => {
    metaRef.current.clear();
    setItems([]);
  };

  const isBusy = items.some(
    (item) => item.status === "processing" || item.status === "uploading",
  );
  const hasReadyImages = items.some((item) => item.status === "ready");
  // Blocks posting: a visible-but-failed tile must be retried or removed, so
  // a post can never silently drop an image the user believes is attached.
  const hasErrors = items.some((item) => item.status === "error");

  const readyImages = (): PostImageInput[] =>
    items.flatMap((item) =>
      item.status === "ready" && item.key
        ? [{ key: item.key, width: item.width, height: item.height }]
        : [],
    );

  return {
    items,
    addFiles,
    remove,
    retry,
    resetAfterPost,
    isBusy,
    hasReadyImages,
    hasErrors,
    readyImages,
  };
}

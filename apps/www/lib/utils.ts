import { formatDistanceToNow } from "date-fns";
import { customAlphabet, nanoid } from "nanoid";
import { toast } from "sonner";

export function generateUsernameId(length = 12) {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const nanoid = customAlphabet(alphabet, length);
  const id = nanoid();

  return id;
}

export function shortTimeAgo(date: Date | string) {
  // Direct callers (note-card, repost-header) receive JSON-serialized ISO
  // strings, not Date objects — normalize and guard so a bad value renders
  // nothing instead of "Invalid Date".
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    return "";
  }

  const distance = formatDistanceToNow(d);

  if (distance === "less than a minute") {
    return "just now";
  }

  const minutesMatch = distance.match(/(\d+)\s+min/);
  if (minutesMatch) {
    return `${minutesMatch[1]}m`;
  }

  const hoursMatch = distance.match(/(\d+)\s+hour/);
  if (hoursMatch) {
    return `${hoursMatch[1]}h`;
  }

  const daysMatch = distance.match(/(\d+)\s+day/);
  if (daysMatch) {
    return `${daysMatch[1]}d`;
  }

  const monthsMatch = distance.match(/(\d+)\s+month/);
  if (monthsMatch) {
    return `${monthsMatch[1]}mo`;
  }

  const yearsMatch = distance.match(/(\d+)\s+year/);
  if (yearsMatch) {
    return `${yearsMatch[1]}y`;
  }

  return distance;
}

export const getBaseUrl = () => {
  // Prefer an explicit site URL, then Vercel's STABLE production domain.
  // VERCEL_URL is the per-deployment host (e.g. umamin-abc123.vercel.app) — wrong
  // for canonical/OG/sitemap — so it's only a preview-env fallback now. [#37]
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
};

export function formatUsername(username: string) {
  const formattedUsername = username.startsWith("%40")
    ? username.split("%40").at(1)
    : username;

  return formattedUsername ?? "";
}

export function formatContent(content: string) {
  return content.replace(/(\r\n|\n|\r){2,}/g, "\n\n").trim();
}

async function dataUrlToPngFile(
  dataUrl: string,
  filename: string,
): Promise<File | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], filename, { type: "image/png" });
  } catch (err) {
    console.log(err);
    return null;
  }
}

const EXPORT_BG = "#111113";

// Pads the rendered card onto a larger canvas so the export is social-ready: a
// uniform inset margin on every side, and landscape cards grown to 1:1 (tall
// cards keep their portrait ratio — already postable). Returns the original on
// any failure so a save never breaks over framing.
async function padForSharing(dataUrl: string): Promise<string> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();

    const { width: w, height: h } = img;
    const margin = Math.round(Math.max(w, h) * 0.05);
    const canvasW = w + margin * 2;
    const canvasH = Math.max(h + margin * 2, canvasW);

    const canvas = document.createElement("canvas");
    canvas.width = canvasW;
    canvas.height = canvasH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.fillStyle = EXPORT_BG;
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.drawImage(
      img,
      Math.round((canvasW - w) / 2),
      Math.round((canvasH - h) / 2),
    );

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.log(err);
    return dataUrl;
  }
}

export const saveImage = async (id: string, isPost?: boolean) => {
  const target = document.querySelector(`#${id}`);

  if (!target) {
    toast.error("Something went wrong.");
    return;
  }

  // Loaded on demand so the ~212KB modern-screenshot lib never ships in the hot
  // feed/profile/chat client bundles — it's only needed for this download.
  const { domToPng } = await import("modern-screenshot");

  const toastId = toast.loading("Saving...");

  try {
    const rawDataUrl = await domToPng(target, {
      quality: 1,
      scale: 4,
      backgroundColor: EXPORT_BG,
      style: {
        ...(isPost
          ? {
              paddingTop: "12px",
            }
          : {
              scale: "0.9",
              display: "grid",
              placeItems: "center",
            }),
      },
    });

    const dataUrl = await padForSharing(rawDataUrl);

    const filename = `umamin-${nanoid(5)}.png`;

    // Where the Web Share API can take files (iOS/Android, installed PWA), hand
    // off to the native sheet — its "Save Image" lands the photo in the user's
    // gallery, which a plain <a download> can't do on iOS (Files only). Gated to
    // deployed envs to match sharePost and keep local dev a direct download.
    if (process.env.NODE_ENV === "production") {
      const file = await dataUrlToPngFile(dataUrl, filename);

      if (file && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          toast.dismiss(toastId);
          return;
        } catch (err) {
          // Sheet dismissed by the user — leave it, no download.
          if (err instanceof DOMException && err.name === "AbortError") {
            toast.dismiss(toastId);
            return;
          }
          // Any other share failure (e.g. lost user activation) falls through
          // to a direct download below.
        }
      }
    }

    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
    toast.success("Download ready", { id: toastId });
  } catch (err) {
    console.log(err);
    toast.error("An error occured!", { id: toastId });
  }
};

export const sharePost = (postId: string) => {
  try {
    if (typeof window !== "undefined") {
      const url = `${window.location.origin}/post/${postId}`;

      if (
        navigator.share &&
        navigator.canShare?.({ url }) &&
        process.env.NODE_ENV === "production"
      ) {
        navigator.share({ url });
      } else {
        navigator.clipboard.writeText(url);
      }
    }
  } catch (err) {
    console.log(err);
  }
};

export function isOlderThanOneYear(createdAt?: Date | string | null) {
  if (!createdAt) return false;

  const createdDate = new Date(createdAt);
  if (Number.isNaN(createdDate.getTime())) return false; // invalid date

  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return createdDate <= oneYearAgo;
}

/**
 * Extracts a server-action error message from a result, if present. Mutations
 * return `{ error: string }` on failure (incl. rate limiting / validation) WITHOUT
 * throwing, so optimistic-UI call sites must check this and throw to trigger
 * rollback — otherwise a throttled action shows a false success.
 */
export function getActionError(res: unknown): string | undefined {
  if (
    res &&
    typeof res === "object" &&
    "error" in res &&
    typeof (res as { error?: unknown }).error === "string"
  ) {
    return (res as { error: string }).error || undefined;
  }
  return undefined;
}

export function isAlreadyLiked(res: unknown): res is { alreadyLiked: true } {
  return (
    !!res &&
    typeof res === "object" &&
    "alreadyLiked" in res &&
    (res as { alreadyLiked?: boolean }).alreadyLiked === true
  );
}

export function isAlreadyReposted(
  res: unknown,
): res is { alreadyReposted: true } {
  return (
    !!res &&
    typeof res === "object" &&
    "alreadyReposted" in res &&
    (res as { alreadyReposted?: boolean }).alreadyReposted === true
  );
}

export function isAlreadyRemoved(
  res: unknown,
): res is { alreadyRemoved: true } {
  return (
    !!res &&
    typeof res === "object" &&
    "alreadyRemoved" in res &&
    (res as { alreadyRemoved?: boolean }).alreadyRemoved === true
  );
}

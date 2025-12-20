import { formatDistanceToNow } from "date-fns";
import { domToPng } from "modern-screenshot";
import { customAlphabet, nanoid } from "nanoid";
import { toast } from "sonner";

export function generateUsernameId(length = 12) {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  const nanoid = customAlphabet(alphabet, length);
  const id = nanoid();

  return id;
}

export function shortTimeAgo(date: Date) {
  const distance = formatDistanceToNow(date);

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
  return content.replace(/(\r\n|\n|\r){2,}/g, "\n\n");
}

export const saveImage = (id: string, isPost?: boolean) => {
  const target = document.querySelector(`#${id}`);

  if (!target) {
    toast.error("An error occured");
    return;
  }

  toast.promise(
    domToPng(target, {
      quality: 1,
      scale: 4,
      backgroundColor: "#111113",
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
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `umamin-${nanoid(5)}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.log(err);
      }),
    {
      loading: "Saving...",
      success: "Download ready",
      error: "An error occured!",
    },
  );
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

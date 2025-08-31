import { toast } from "sonner";
import { domToPng } from "modern-screenshot";
import { customAlphabet, nanoid } from "nanoid";
import { formatDistanceToNow } from "date-fns";

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

export const saveImage = (id: string) => {
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
        scale: "0.9",
        display: "grid",
        placeItems: "center",
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

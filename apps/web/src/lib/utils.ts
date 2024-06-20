import { toast } from "sonner";
import { domToPng } from "modern-screenshot";
import { formatDistanceToNow, fromUnixTime } from "date-fns";

export const onSaveImage = (id: string) => {
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
        link.download = `umamin-${id}.png`;
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

export const formatError = (err: string) => {
  return err.replace("[GraphQL] ", "");
};

export function shortTimeAgo(epoch: number) {
  const distance = formatDistanceToNow(fromUnixTime(epoch));

  if (distance === "less than a minute") {
    return "just now";
  }

  const minutesMatch = distance.match(/(\d+)\s+min/);
  if (minutesMatch) {
    return `${minutesMatch[1]}m`;
  }

  const daysMatch = distance.match(/(\d+)\s+day/);
  if (daysMatch) {
    return `${daysMatch[1]}h`;
  }

  const hoursMatch = distance.match(/(\d+)\s+hour/);
  if (hoursMatch) {
    return `${hoursMatch[1]}h`;
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

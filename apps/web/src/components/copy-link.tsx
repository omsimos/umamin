import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { Link2Icon } from "lucide-react";
import { toast } from "sonner";
import { captureException } from "@/lib/posthog";

const onCopy = async (url: string) => {
  if (typeof window === "undefined") return;

  try {
    // Awaited: an un-awaited write shows the success toast even when the
    // clipboard write is denied.
    await navigator.clipboard.writeText(url);
    toast.success("Copied.");
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    captureException(err, { source: "share" });
    toast.error("Couldn't copy the link.");
  }
};

export default function CopyLink({ username }: { username: string }) {
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/to/${username}`
      : "";

  if (!url) {
    return (
      <div className="text-muted-foreground flex items-center">
        <Link2Icon className="h-4 w-4 mr-2" />
        <Skeleton className="w-48 h-5" />
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() => void onCopy(url)}
      // Inner <span> keeps the icon off the Button's direct children, so its
      // `has-[>svg]:px-3` can't override `p-0` and re-add left padding.
      className="h-auto justify-start gap-0 p-0 hover:bg-transparent text-muted-foreground flex items-center cursor-pointer"
    >
      <span className="flex items-center gap-2">
        <Link2Icon className="size-4" />
        <Badge variant="secondary">
          {url.replace(/(^\w+:|^)\/\//, "").replace(/^www\./, "")}
        </Badge>
      </span>
    </Button>
  );
}

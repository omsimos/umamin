"use client";

import { Badge } from "@umamin/ui/components/badge";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { Link2Icon } from "lucide-react";
import { toast } from "sonner";

const onCopy = (url: string) => {
  if (typeof window !== "undefined") {
    navigator.clipboard.writeText(url);
    toast.success("Copied.");
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
    <button
      type="button"
      onClick={() => onCopy(url)}
      className="text-muted-foreground flex items-center cursor-pointer"
    >
      <Link2Icon className="h-4 w-4 mr-2" />
      <Badge variant="secondary">{url.replace(/(^\w+:|^)\/\//, "")}</Badge>
    </button>
  );
}

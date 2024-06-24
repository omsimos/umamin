"use client";

import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Badge } from "@umamin/ui/components/badge";
import { Skeleton } from "@umamin/ui/components/skeleton";

const onCopy = (url: string) => {
  if (typeof window !== "undefined") {
    navigator.clipboard.writeText(url);
    toast.success("Copied to clipboard");
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
        <Link2 className="h-4 w-4 mr-2" />
        <Skeleton className="w-48 h-5" />
      </div>
    );
  }

  return (
    <button
      onClick={() => onCopy(url)}
      className="text-muted-foreground flex items-center"
    >
      <Link2 className="h-4 w-4 mr-2" />
      <Badge variant="secondary">{url.replace(/(^\w+:|^)\/\//, "")}</Badge>
    </button>
  );
}

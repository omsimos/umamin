"use client";

import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
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
    <Button
      type="button"
      variant="ghost"
      onClick={() => onCopy(url)}
      // Neutralize Button's size/padding/gap/hover so it keeps the original
      // inline icon+badge look; we only want the focus-visible ring it adds.
      className="h-auto justify-start gap-0 p-0 hover:bg-transparent text-muted-foreground flex items-center cursor-pointer"
    >
      <Link2Icon className="size-4 mr-2" />
      <Badge variant="secondary">{url.replace(/(^\w+:|^)\/\//, "")}</Badge>
    </Button>
  );
}

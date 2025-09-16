"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { formatDistanceToNow } from "date-fns";
import { MessageCircleDashedIcon, MessageCircleMoreIcon } from "lucide-react";
import { Menu } from "@/components/menu";
import { saveImage } from "@/lib/utils";
import { clearNoteAction, getCurrentNoteAction } from "@/app/actions/note";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { toast } from "sonner";

export function CurrentUserNote() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["current_note"],
    queryFn: getCurrentNoteAction,
  });

  const clearNoteMutation = useMutation({
    mutationFn: clearNoteAction,
    onSuccess: () => {
      toast.success("Your note has been cleared.");
      queryClient.invalidateQueries({ queryKey: ["current_note"] });
    },
    onError: (err) => {
      console.log(err);
      toast.error("An error occurred while clearing your note.");
    },
  });

  if (!data || !data.content) {
    return;
  }

  const menuItems = [
    {
      title: "Save Image",
      onClick: () => saveImage(`umamin-${data.id}`),
    },
    {
      title: "Clear Note",
      onClick: () => clearNoteMutation.mutate(),
      className: "text-red-500",
    },
  ];

  if (isLoading || clearNoteMutation.isPending) {
    return (
      <div>
        <Card className="flex flex-col items-start justify-between">
          <CardHeader className="w-full flex items-center justify-between text-muted-foreground">
            <div className="flex items-center gap-2">
              <Skeleton className="size-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="size-4" />
          </CardHeader>

          <CardContent className="flex w-full">
            <div className="w-full space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>

          <CardFooter>
            <Skeleton className="h-3 w-32" />
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div id={`umamin-${data.id}`}>
      <Card className="flex flex-col items-start justify-between">
        <CardHeader className="w-full flex items-center justify-between text-muted-foreground">
          <div className="flex items-center gap-2">
            {data.isAnonymous ? (
              <MessageCircleDashedIcon className="size-4" />
            ) : (
              <MessageCircleMoreIcon className="size-4" />
            )}
            <h3>Your {data.isAnonymous && "anonymous"} note</h3>
          </div>

          <Menu menuItems={menuItems} />
        </CardHeader>

        <CardContent className="flex w-full">
          <div className="whitespace-pre-wrap break-words rounded-lg min-w-0">
            {data.content}
          </div>
        </CardContent>

        <CardFooter>
          <p className="text-muted-foreground text-sm italic">
            Shared{" "}
            {data.updatedAt &&
              formatDistanceToNow(data.updatedAt, {
                addSuffix: true,
              })}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

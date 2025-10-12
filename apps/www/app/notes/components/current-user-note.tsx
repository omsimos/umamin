"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SelectUser } from "@umamin/db/schema/user";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@umamin/ui/components/card";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { cn } from "@umamin/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  BadgeCheckIcon,
  MessageCircleDashedIcon,
  MessageCircleMoreIcon,
  ScanFaceIcon,
} from "lucide-react";
import { toast } from "sonner";
import { clearNoteAction, getCurrentNoteAction } from "@/app/actions/note";
import { Menu } from "@/components/menu";
import { saveImage } from "@/lib/utils";

export function CurrentUserNote({ currentUser }: { currentUser: SelectUser }) {
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
          <div className="flex items-center gap-1">
            {data.isAnonymous ? (
              <MessageCircleDashedIcon className="size-4" />
            ) : (
              <MessageCircleMoreIcon className="size-4" />
            )}
            <h3 className="font-medium">
              Your {data.isAnonymous ? "anonymous" : "shared"} note
            </h3>
          </div>

          <Menu menuItems={menuItems} />
        </CardHeader>

        <CardContent className="w-full">
          <div
            className={cn("flex gap-3 mb-4", {
              "blur-xs": data.isAnonymous,
            })}
          >
            <Avatar className="relative top-1">
              <AvatarImage
                className="rounded-full"
                src={currentUser?.imageUrl ?? ""}
                alt="User avatar"
              />
              <AvatarFallback className="text-xs">
                <ScanFaceIcon />
              </AvatarFallback>
            </Avatar>

            <div className="flex flex-col mt-1">
              <div className="flex items-center space-x-1">
                <span className="font-semibold flex-none text-base leading-none">
                  {currentUser.displayName
                    ? currentUser.displayName
                    : currentUser.username}
                </span>
                {process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(",").includes(
                  currentUser.username,
                ) && <BadgeCheckIcon className="w-4 h-4 text-pink-500" />}
              </div>

              <span className="text-muted-foreground truncate">
                @{currentUser.username}
              </span>
            </div>
          </div>

          <div className="whitespace-pre-wrap break-words bg-muted p-5 rounded-lg min-w-0">
            {data.content}
          </div>
        </CardContent>

        <CardFooter className="justify-center w-full">
          <p className="text-muted-foreground text-center text-sm italic">
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

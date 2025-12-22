"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SelectUser } from "@umamin/db/schema/user";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Badge } from "@umamin/ui/components/badge";
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
  DownloadIcon,
  MessageCircleDashedIcon,
  MessageCircleMoreIcon,
  MessageSquareXIcon,
  ScanFaceIcon,
  ScrollIcon,
} from "lucide-react";
import { toast } from "sonner";
import { clearNoteAction, getCurrentNoteAction } from "@/app/actions/note";
import { Menu } from "@/components/menu";
import { isOlderThanOneYear, saveImage } from "@/lib/utils";

export function CurrentUserNote({ currentUser }: { currentUser: SelectUser }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["current_note"],
    queryFn: async () => (await getCurrentNoteAction()) ?? null,
  });

  const clearNoteMutation = useMutation({
    mutationFn: clearNoteAction,
    onSuccess: () => {
      toast.success("Note cleared.");
      queryClient.invalidateQueries({ queryKey: ["current_note"] });
    },
    onError: (err) => {
      console.log(err);
      toast.error("Couldn't clear note.");
    },
  });

  if (!data || !data.content) {
    return null;
  }

  const menuItems = [
    {
      title: "Save Image",
      onClick: () => saveImage(`umamin-${data.id}`),
      icon: <DownloadIcon className="h-4 w-4" />,
    },
    {
      title: "Clear Note",
      onClick: () => clearNoteMutation.mutate(),
      className: "text-red-500",
      icon: <ScrollIcon className="h-4 w-4" />,
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
            <Badge variant="secondary" className="font-medium">
              {data.isAnonymous ? (
                <MessageCircleDashedIcon className="size-4" />
              ) : (
                <MessageCircleMoreIcon className="size-4" />
              )}
              Your {data.isAnonymous ? "anonymous" : "shared"} note
            </Badge>
          </div>

          <div className="flex gap-1 items-center">
            {currentUser.quietMode && <MessageSquareXIcon className="size-5" />}
            <Menu menuItems={menuItems} />
          </div>
        </CardHeader>

        <CardContent className="w-full">
          <div
            className={cn("flex gap-3 mb-4", {
              "blur-xs": data.isAnonymous,
            })}
          >
            <Avatar
              className={cn("relative top-1", {
                "avatar-shine": isOlderThanOneYear(currentUser?.createdAt),
              })}
            >
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

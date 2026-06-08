"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  BadgeCheckIcon,
  DownloadIcon,
  FlameIcon,
  MessageCircleDashedIcon,
  MessageCircleMoreIcon,
  MessageSquareXIcon,
  ScanFaceIcon,
  ScrollIcon,
} from "lucide-react";
import { toast } from "sonner";
import { clearNoteAction } from "@/app/actions/note";
import { GroupBadge } from "@/components/group-badge";
import { Menu } from "@/components/menu";
import { PostBody } from "@/components/post-body";
import { pageQueryOptions, queryKeys } from "@/lib/query";
import { patchNote } from "@/lib/query-cache";
import { fetchCurrentNote } from "@/lib/query-fetchers";
import type { NoteItem, NotesResponse } from "@/lib/query-types";
import {
  getActionError,
  hasUmaminPlus,
  saveImage,
  shortTimeAgo,
} from "@/lib/utils";
import type { PublicUserWithBadge } from "@/types/user";

export function CurrentUserNote({
  currentUser,
}: {
  currentUser: PublicUserWithBadge;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<NoteItem | null>({
    ...pageQueryOptions(queryKeys.currentNote(), fetchCurrentNote),
  });

  const clearNoteMutation = useMutation({
    // Throw on a server error ({error} from rate limiting / auth / failure) so
    // onError fires instead of onSuccess optimistically clearing a note that
    // wasn't actually cleared.
    mutationFn: async () => {
      const res = await clearNoteAction();
      const actionError = getActionError(res);
      if (actionError) {
        throw new Error(actionError);
      }
      return res;
    },
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.currentNote(), null);
      if (data?.id) {
        queryClient.setQueriesData<
          import("@tanstack/react-query").InfiniteData<NotesResponse>
        >({ queryKey: queryKeys.notesRoot() }, (current) =>
          patchNote(current, data.id, () => null),
        );
      }
      toast.success("Gone like it never happened.");
    },
    onError: (err) => {
      console.log(err);
      toast.error(err instanceof Error ? err.message : "Couldn't clear note.");
    },
  });

  if (!data?.content) {
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
      <Card
        className={cn(
          "flex flex-col items-start justify-between",
          data.isAnonymous && "border-dashed",
        )}
      >
        <CardHeader className="w-full flex items-center justify-between text-muted-foreground">
          <Badge variant="secondary" className="font-medium">
            {data.isAnonymous ? (
              <MessageCircleDashedIcon className="size-4" />
            ) : (
              <MessageCircleMoreIcon className="size-4" />
            )}
            Your {data.isAnonymous ? "anonymous" : "shared"} note
          </Badge>

          <div className="flex gap-x-1 items-center">
            {data.updatedAt && (
              <span className="text-xs text-muted-foreground mr-1">
                {shortTimeAgo(data.updatedAt)}
              </span>
            )}
            {currentUser.quietMode && <MessageSquareXIcon className="size-5" />}
            <Menu menuItems={menuItems} />
          </div>
        </CardHeader>

        <CardContent className="w-full">
          <div className="flex gap-3 mb-4">
            {data.isAnonymous ? (
              <>
                <Avatar>
                  <AvatarFallback>
                    <ScanFaceIcon />
                  </AvatarFallback>
                </Avatar>

                <div className="flex flex-col mt-1">
                  <span className="text-muted-foreground text-base font-semibold leading-none">
                    anonymous
                  </span>
                  <span className="text-xs text-muted-foreground pt-1">
                    only you know it's you
                  </span>
                </div>
              </>
            ) : (
              <>
                <Avatar
                  className={cn("relative top-1", {
                    "avatar-shine": hasUmaminPlus(currentUser?.createdAt),
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
                    {process.env.NEXT_PUBLIC_VERIFIED_USERS?.split(
                      ",",
                    ).includes(currentUser.username) && (
                      <BadgeCheckIcon className="w-4 h-4 text-pink-500" />
                    )}
                    <GroupBadge badge={currentUser.groupBadge} />
                  </div>

                  <span className="text-muted-foreground truncate">
                    @{currentUser.username}
                  </span>
                </div>
              </>
            )}
          </div>

          <PostBody
            content={data.content}
            className="font-display text-lg leading-snug"
          />
        </CardContent>

        {(data.reactionCount ?? 0) > 0 && (
          <CardFooter className="w-full justify-center">
            <p className="flex items-center gap-1.5 text-sm text-orange-500">
              <FlameIcon className="size-4 fill-orange-500" />
              {data.reactionCount === 1
                ? "1 stranger reacted to this"
                : `${data.reactionCount} strangers reacted to this`}
            </p>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

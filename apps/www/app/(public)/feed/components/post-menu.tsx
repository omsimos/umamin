"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@umamin/ui/components/alert-dialog";
import { Button } from "@umamin/ui/components/button";
import {
  DownloadIcon,
  PinIcon,
  PinOffIcon,
  Share2Icon,
  Trash2Icon,
  UserXIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  deletePostAction,
  pinPostAction,
  unpinPostAction,
} from "@/app/actions/post";
import { BlockUserDialog } from "@/components/block-user-dialog";
import { Menu } from "@/components/menu";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { patchCurrentUser, removePostFromFeed } from "@/lib/query-cache";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import type { CurrentUserResponse, FeedResponse } from "@/lib/query-types";
import { saveImage, sharePost } from "@/lib/utils";
import type { FeedItem } from "@/types/post";

type PostMenuProps = {
  postId: string;
  authorId: string;
  authorUsername?: string;
  imageId: string;
  isAuthenticated: boolean;
  currentUserId?: string;
  onDeleted?: () => void;
};

export function PostMenu({
  postId,
  authorId,
  authorUsername,
  imageId,
  isAuthenticated,
  currentUserId,
  onDeleted,
}: PostMenuProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const canDelete = !!currentUserId && currentUserId === authorId;
  const canBlock = !!currentUserId && !!authorId && currentUserId !== authorId;

  // Shared app-wide cache (usually a hit); carries pinnedPostId for the
  // pin/unpin menu state on own posts.
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    enabled: canDelete,
  });
  const isPinned = currentUser?.user?.pinnedPostId === postId;

  const pinMutation = useMutation({
    mutationFn: async () => {
      const res = isPinned
        ? await unpinPostAction()
        : await pinPostAction({ postId });
      if (res.error) {
        throw new Error(res.error);
      }
      return !isPinned;
    },
    onSuccess: (nowPinned) => {
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (u) => ({
            ...u,
            pinnedPostId: nowPinned ? postId : null,
          })),
      );
      // Patch the actor's profile-list cache directly instead of refetching:
      // the public posts route is CDN-cached (s-maxage + SWR), which tag
      // invalidation can't purge — a refetch would just read back the
      // pre-pin order for up to ~4 minutes. Visitors converge on the CDN's
      // own schedule, same per-viewer-instant split as likes/reposts. The
      // previous pin only loses its badge here; its true chronological slot
      // is restored by the next natural revalidate.
      queryClient.setQueriesData<
        import("@tanstack/react-query").InfiniteData<FeedResponse>
      >({ queryKey: ["user-posts"] }, (old) => {
        if (!old) return old;

        let pinnedItem: FeedItem | undefined;
        const pages = old.pages.map((page) => ({
          ...page,
          data: page.data.flatMap((item): FeedItem[] => {
            if (item.type !== "post") return [item];

            if (item.post.id === postId) {
              const updated: FeedItem = {
                ...item,
                post: { ...item.post, isPinned: nowPinned },
              };
              if (nowPinned) {
                pinnedItem = updated;
                return [];
              }
              return [updated];
            }

            if (item.post.isPinned) {
              return [{ ...item, post: { ...item.post, isPinned: false } }];
            }

            return [item];
          }),
        }));

        if (pinnedItem && pages[0]) {
          pages[0] = { ...pages[0], data: [pinnedItem, ...pages[0].data] };
        }

        return { ...old, pages };
      });
      toast.success(
        nowPinned ? "Pinned to your profile." : "Unpinned from your profile.",
      );
    },
    onError: (err) => {
      console.error(err);
      toast.error(err.message ?? "Couldn't update pin.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await deletePostAction({ postId });

      if (res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      queryClient.setQueriesData<
        import("@tanstack/react-query").InfiniteData<FeedResponse>
      >({ queryKey: queryKeys.postsRoot() }, (current) =>
        removePostFromFeed(current, postId),
      );
      queryClient.setQueryData(queryKeys.post(postId), null);
      queryClient.removeQueries({ queryKey: queryKeys.postComments(postId) });
      toast.success("Post deleted.");
      onDeleted?.();
    },
    onError: (err) => {
      console.error(err);
      toast.error("Couldn't delete post.");
    },
  });

  if (!isAuthenticated) return null;

  const menuItems = [
    {
      title: "Save Image",
      onClick: () => saveImage(imageId, true),
      icon: <DownloadIcon className="h-4 w-4" />,
    },
    {
      title: "Share",
      onClick: () => sharePost(postId),
      icon: <Share2Icon className="h-4 w-4" />,
    },
    ...(canDelete
      ? [
          {
            title: isPinned ? "Unpin from profile" : "Pin to profile",
            onClick: () => {
              if (!pinMutation.isPending) pinMutation.mutate();
            },
            icon: isPinned ? (
              <PinOffIcon className="h-4 w-4" />
            ) : (
              <PinIcon className="h-4 w-4" />
            ),
          },
          {
            title: "Delete",
            onClick: () => setOpen(true),
            className: "text-red-500",
            icon: <Trash2Icon className="h-4 w-4" />,
          },
        ]
      : []),
    ...(canBlock
      ? [
          {
            title: authorUsername ? `Block @${authorUsername}` : "Block",
            onClick: () => setBlockOpen(true),
            className: "text-red-500",
            icon: <UserXIcon className="h-4 w-4" />,
          },
        ]
      : []),
  ];

  return (
    <>
      {canDelete && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this post?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The post and its comments will be
                removed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  disabled={deleteMutation.isPending}
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                >
                  Continue
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {canBlock && (
        <BlockUserDialog
          userId={authorId}
          username={authorUsername}
          open={blockOpen}
          onOpenChange={setBlockOpen}
          onBlocked={() => {
            // The user-blocks tag is already busted server-side; refetch so the
            // per-viewer overlay drops the blocked author's content.
            queryClient.invalidateQueries({ queryKey: queryKeys.postsRoot() });
            queryClient.invalidateQueries({ queryKey: queryKeys.notesRoot() });
          }}
        />
      )}

      <Menu menuItems={menuItems} />
    </>
  );
}

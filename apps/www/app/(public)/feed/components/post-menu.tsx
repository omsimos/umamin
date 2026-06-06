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
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  deletePostAction,
  pinPostAction,
  unpinPostAction,
} from "@/app/actions/post";
import { Menu } from "@/components/menu";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { patchCurrentUser, removePostFromFeed } from "@/lib/query-cache";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import type { CurrentUserResponse, FeedResponse } from "@/lib/query-types";
import { saveImage, sharePost } from "@/lib/utils";

type PostMenuProps = {
  postId: string;
  authorId: string;
  imageId: string;
  isAuthenticated: boolean;
  currentUserId?: string;
  onDeleted?: () => void;
};

export function PostMenu({
  postId,
  authorId,
  imageId,
  isAuthenticated,
  currentUserId,
  onDeleted,
}: PostMenuProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const canDelete = !!currentUserId && currentUserId === authorId;

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
      // Re-render the profile list with the new pin order, but drop loaded
      // pages beyond the first before invalidating — otherwise a deep-scrolled
      // profile refetches EVERY page against the just-busted server cache
      // (same bounded-refetch trick as the feed's "show new posts").
      queryClient.setQueriesData<
        import("@tanstack/react-query").InfiniteData<FeedResponse>
      >({ queryKey: ["user-posts"] }, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.slice(0, 1),
              pageParams: old.pageParams.slice(0, 1),
            }
          : old,
      );
      queryClient.invalidateQueries({ queryKey: ["user-posts"] });
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

      <Menu menuItems={menuItems} />
    </>
  );
}

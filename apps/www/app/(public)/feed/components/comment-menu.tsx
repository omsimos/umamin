"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteCommentAction } from "@/app/actions/post";
import { Menu } from "@/components/menu";
import { queryKeys } from "@/lib/query";
import {
  patchPostAcrossFeed,
  patchPostResponse,
  removeComment,
} from "@/lib/query-cache";
import type {
  CommentsResponse,
  FeedResponse,
  PostResponse,
} from "@/lib/query-types";

type CommentMenuProps = {
  commentId: string;
  postId: string;
  authorId: string;
  isAuthenticated: boolean;
  currentUserId?: string;
};

export function CommentMenu({
  commentId,
  postId,
  authorId,
  isAuthenticated,
  currentUserId,
}: CommentMenuProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const canDelete = !!currentUserId && currentUserId === authorId;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await deleteCommentAction({ commentId });

      if (res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      // Drop the comment from the thread...
      queryClient.setQueryData<InfiniteData<CommentsResponse>>(
        queryKeys.postComments(postId),
        (current) => removeComment(current, commentId),
      );

      // ...and decrement the parent post's comment count across feed + detail.
      queryClient.setQueriesData<InfiniteData<FeedResponse>>(
        { queryKey: queryKeys.postsRoot() },
        (current) =>
          patchPostAcrossFeed(current, postId, (post) => ({
            ...post,
            commentCount: Math.max((post.commentCount ?? 0) - 1, 0),
          })),
      );
      queryClient.setQueryData<PostResponse>(
        queryKeys.post(postId),
        (current) =>
          patchPostResponse(current, (post) => ({
            ...post,
            commentCount: Math.max((post.commentCount ?? 0) - 1, 0),
          })),
      );

      toast.success("Comment deleted.");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Couldn't delete comment.");
    },
  });

  // Only the comment's author gets a menu at all (delete is the only action).
  if (!isAuthenticated || !canDelete) return null;

  const menuItems = [
    {
      title: "Delete",
      onClick: () => setOpen(true),
      className: "text-red-500",
      icon: <Trash2Icon className="h-4 w-4" />,
    },
  ];

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Your comment will be permanently
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

      <Menu menuItems={menuItems} />
    </>
  );
}

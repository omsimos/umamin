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
import { Trash2Icon, UserXIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteCommentAction } from "@/app/actions/post";
import { BlockUserDialog } from "@/components/block-user-dialog";
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
  authorUsername?: string;
  isAuthenticated: boolean;
  currentUserId?: string;
};

export function CommentMenu({
  commentId,
  postId,
  authorId,
  authorUsername,
  isAuthenticated,
  currentUserId,
}: CommentMenuProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const canDelete = !!currentUserId && currentUserId === authorId;
  const canBlock = !!currentUserId && !!authorId && currentUserId !== authorId;

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

  if (!isAuthenticated) return null;

  const menuItems = [
    ...(canDelete
      ? [
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

  if (menuItems.length === 0) return null;

  return (
    <>
      {canDelete && (
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
      )}

      {canBlock && (
        <BlockUserDialog
          userId={authorId}
          username={authorUsername}
          open={blockOpen}
          onOpenChange={setBlockOpen}
          onBlocked={() => {
            // Drop the blocked author's comments here plus their posts/notes
            // everywhere else (overlay tags are already busted server-side).
            queryClient.invalidateQueries({
              queryKey: queryKeys.postComments(postId),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.postsRoot() });
            queryClient.invalidateQueries({ queryKey: queryKeys.notesRoot() });
          }}
        />
      )}

      <Menu menuItems={menuItems} />
    </>
  );
}

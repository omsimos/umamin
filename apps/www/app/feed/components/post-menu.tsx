"use client";

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
import { DownloadIcon, Share2Icon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deletePostAction } from "@/app/actions/post";
import { Menu } from "@/components/menu";
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

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await deletePostAction({ postId });

      if (res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      toast.success("Post deleted");
      onDeleted?.();
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to delete post. Please try again.");
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

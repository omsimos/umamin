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
import { toast } from "sonner";
import { blockUserAction } from "@/app/actions/user";
import { queryKeys } from "@/lib/query";

type BlockUserDialogProps = {
  userId: string;
  username?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Per-surface cache invalidation (feed/notes/comments) after a block lands.
  onBlocked?: () => void;
};

export function BlockUserDialog({
  userId,
  username,
  open,
  onOpenChange,
  onBlocked,
}: BlockUserDialogProps) {
  const queryClient = useQueryClient();

  const blockMutation = useMutation({
    mutationFn: async () => {
      const res = await blockUserAction({ userId });

      if (res && "error" in res && res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      // Refetch options are stable (no refetch-on-mount), so every cache the
      // block changes must be invalidated explicitly. Settings' blocked-users
      // list and the inbox (server-filtered) are common to all surfaces; the
      // profile-viewer entry is removed (not invalidated) because resolveViewer
      // short-circuits on getQueryData and the query is enabled: false.
      queryClient.invalidateQueries({ queryKey: queryKeys.blockedUsers() });
      queryClient.invalidateQueries({
        queryKey: queryKeys.receivedMessages(),
      });
      if (username) {
        queryClient.removeQueries({
          queryKey: queryKeys.userProfileViewer(username),
        });
      }
      toast.success("User blocked.");
      onBlocked?.();
    },
    onError: (err) => {
      console.error(err);
      toast.error("Couldn't block user.");
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Block {username ? `@${username}` : "this user"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            You won't see their posts, notes, or comments, and you won't receive
            each other's messages. You can unblock them anytime from Settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              disabled={blockMutation.isPending}
              variant="destructive"
              onClick={() => blockMutation.mutate()}
            >
              Block
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

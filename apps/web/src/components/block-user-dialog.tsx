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
import { blockUserAction } from "@/lib/actions";
import { ExpectedError } from "@/lib/expected-error";
import { invalidateAfterBlock } from "@/lib/query-cache";

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
        throw new ExpectedError(res.error);
      }
    },
    onSuccess: () => {
      invalidateAfterBlock(queryClient, username);
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

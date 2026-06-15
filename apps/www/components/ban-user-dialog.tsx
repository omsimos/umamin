"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@umamin/ui/components/alert-dialog";
import { Button } from "@umamin/ui/components/button";
import { Label } from "@umamin/ui/components/label";
import { Textarea } from "@umamin/ui/components/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { banUserAction, unbanUserAction } from "@/app/actions/moderation";
import { queryKeys } from "@/lib/query";
import { getActionError } from "@/lib/utils";

type BanUserDialogProps = {
  username: string;
  // Current ban state — controls ban vs unban flow.
  banned: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function BanUserDialog({
  username,
  banned,
  open,
  onOpenChange,
}: BanUserDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = banned
        ? await unbanUserAction({ username })
        : await banUserAction({
            username,
            reason: reason.trim() || undefined,
          });
      const error = getActionError(res);
      if (error) {
        throw new Error(error);
      }
    },
    onSuccess: () => {
      // The viewer overlay carries the moderator-only isBanned flag — refetch
      // so the menu flips between Ban/Unban.
      queryClient.invalidateQueries({
        queryKey: queryKeys.userProfileViewer(username),
      });
      toast.success(banned ? "User unbanned." : "User banned.");
      setReason("");
      onOpenChange(false);
    },
    onError: (err) => {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Couldn't update ban status.",
      );
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {banned ? `Unban @${username}?` : `Ban @${username}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {banned
              ? "They'll be able to log in and use Umamin again. Their content was never hidden."
              : "They'll be logged out immediately and can't log back in. Their existing content stays visible. You're acting as a moderator."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!banned && (
          <div className="space-y-2">
            <Label htmlFor="ban-reason">Reason (optional)</Label>
            <Textarea
              id="ban-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="Shown to the user when they try to log in."
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            disabled={mutation.isPending}
            variant="destructive"
            onClick={() => mutation.mutate()}
          >
            {banned ? "Unban" : "Ban"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

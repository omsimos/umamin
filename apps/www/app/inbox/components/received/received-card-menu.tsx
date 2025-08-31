"use client";

import { toast } from "sonner";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteMessageAction } from "@/app/actions/message";
import { Menu } from "@/components/menu";
import { ReplyDialog } from "./reply-dialog";
import { Button } from "@/components/ui/button";
import { saveImage } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type ReceivedMenuProps = {
  id: string;
  question: string;
  content: string;
  reply?: string | null;
  updatedAt?: Date | null;
};

export function ReceivedMessageMenu(props: ReceivedMenuProps) {
  const id = props.id;
  const queryClient = useQueryClient();
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await deleteMessageAction(id);

      if (res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["received_messages"] });
      toast.success("Message deleted");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to delete message. Please try again.");
    },
  });

  const menuItems = [
    {
      title: "Reply",
      onClick: () => setReplyDialogOpen(true),
    },
    {
      title: "Save Image",
      onClick: () => saveImage(`umamin-${id}`),
    },
    {
      title: "Delete",
      onClick: () => setOpen(true),
      className: "text-red-500",
    },
  ];

  return (
    <>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              message you received.
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

      <ReplyDialog
        open={replyDialogOpen}
        onOpenChange={setReplyDialogOpen}
        data={{ ...props }}
      />
    </>
  );
}

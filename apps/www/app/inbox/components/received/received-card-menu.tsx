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
import {
  DownloadIcon,
  MessageSquareTextIcon,
  MessageSquareXIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteMessageAction } from "@/app/actions/message";
import { blockUserAction, unblockUserAction } from "@/app/actions/user";
import { Menu } from "@/components/menu";
import { saveImage } from "@/lib/utils";
import { ReplyDialog } from "./reply-dialog";

export type ReceivedMenuProps = {
  id: string;
  senderId?: string | null;
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
  const [blockOpen, setBlockOpen] = useState(false);
  const canBlock = !!props.senderId;

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

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!props.senderId) return;
      const res = await blockUserAction({ userId: props.senderId });

      if (res && "error" in res && res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["received_messages"] });
      toast.success("User blocked", {
        action: {
          label: "Undo",
          onClick: () => {
            if (props.senderId) {
              unblockUserAction({ userId: props.senderId }).catch((err) =>
                console.error(err),
              );
            }
          },
        },
      });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to block user. Please try again.");
    },
  });

  const menuItems = [
    {
      title: "Reply",
      onClick: () => setReplyDialogOpen(true),
      icon: <MessageSquareTextIcon className="h-4 w-4" />,
    },
    {
      title: "Save Image",
      onClick: () => saveImage(`umamin-${id}`),
      icon: <DownloadIcon className="h-4 w-4" />,
    },
    ...(canBlock
      ? [
          {
            title: "Block",
            onClick: () => setBlockOpen(true),
            className: "text-red-500",
            icon: <MessageSquareXIcon className="h-4 w-4" />,
          },
        ]
      : []),
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

      {canBlock && (
        <AlertDialog open={blockOpen} onOpenChange={setBlockOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Block this user?</AlertDialogTitle>
              <AlertDialogDescription>
                You won’t receive messages or see content from this user.
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
                  Continue
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <Menu menuItems={menuItems} />

      <ReplyDialog
        open={replyDialogOpen}
        onOpenChange={setReplyDialogOpen}
        data={{ ...props }}
      />
    </>
  );
}

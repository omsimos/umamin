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
import { DownloadIcon, MessageSquareTextIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { deleteMessageAction } from "@/app/actions/message";
import { Menu } from "@/components/menu";
import { queryKeys } from "@/lib/query";
import { removeMessage } from "@/lib/query-cache";
import type { MessagesResponse } from "@/lib/query-types";
import { saveImage } from "@/lib/utils";
import { ReplyDialog } from "./reply-dialog";

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
      queryClient.setQueryData<
        import("@tanstack/react-query").InfiniteData<MessagesResponse>
      >(queryKeys.receivedMessages(), (current) => removeMessage(current, id));
      toast.success("Message deleted.");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Couldn't delete message.");
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

      <Menu menuItems={menuItems} />

      <ReplyDialog
        open={replyDialogOpen}
        onOpenChange={setReplyDialogOpen}
        data={{ ...props }}
      />
    </>
  );
}

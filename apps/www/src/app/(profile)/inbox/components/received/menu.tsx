"use client";

import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import client from "@/lib/gql/client";
import { logEvent } from "firebase/analytics";

import { ReplyDialog } from "./reply";
import { analytics } from "@/lib/firebase";
import { formatError, onSaveImage } from "@/lib/utils";

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
import { Menu } from "@/app/components/menu";
import { useMessageStore } from "@/store/useMessageStore";

const DELETE_MESSAGE_MUTATION = graphql(`
  mutation DeleteMessage($id: String!) {
    deleteMessage(id: $id)
  }
`);

const deleteMessagePersisted = graphql.persisted(
  "402dc5134e5ce477b966ad52be60a7ce75ca058a46a6f024bf34074a878a5a7d",
  DELETE_MESSAGE_MUTATION
);

export type ReceivedMenuProps = {
  id: string;
  question: string;
  content: string;
  reply?: string | null;
  updatedAt?: number | null;
};

export function ReceivedMessageMenu(props: ReceivedMenuProps) {
  const id = props.id;
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const deleteMessage = useMessageStore((state) => state.delete);
  const [open, setOpen] = useState(false);

  const onDelete = async () => {
    const res = await client.mutation(deleteMessagePersisted, { id });

    if (res.error) {
      toast.error(formatError(res.error.message));
      return;
    }

    toast.success("Message deleted");
    deleteMessage(id);

    logEvent(analytics, "delete_message");
  };

  const menuItems = [
    {
      title: "Reply",
      onClick: () => setReplyDialogOpen(true),
    },
    {
      title: "Save Image",
      onClick: () => {
        onSaveImage(`umamin-${id}`);
        logEvent(analytics, "save_image_message");
      },
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
            <AlertDialogAction onClick={onDelete}>Continue</AlertDialogAction>
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

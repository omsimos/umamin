"use client";

import { toast } from "sonner";
import { graphql } from "gql.tada";
import { getClient } from "@/lib/gql";
import { Menu } from "@/app/components/menu";
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
} from "@ui/components/ui/alert-dialog";
import { useMessageStore } from "@/store/useMessageStore";
import { onSaveImage } from "@/lib/utils";
import { analytics } from "@/lib/firebase";
import { logEvent } from "firebase/analytics";

const DELETE_MESSAGE_MUTATION = graphql(`
  mutation DeleteMessage($id: String!) {
    deleteMessage(id: $id)
  }
`);

export function ReceivedMessageMenu({ id }: { id: string }) {
  const deleteMessage = useMessageStore((state) => state.delete);
  const [open, setOpen] = useState(false);

  const onDelete = () => {
    getClient()
      .mutation(DELETE_MESSAGE_MUTATION, { id })
      .then((res) => {
        if (res.error) {
          toast.error("An error occured");
          return;
        }

        toast.success("Message deleted");
        deleteMessage(id);

        logEvent(analytics, "delete_message");
      });
  };

  const menuItems = [
    {
      title: "Save Image",
      onClick: () => {
        onSaveImage(id);
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
    </>
  );
}

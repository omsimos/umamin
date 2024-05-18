"use client";

import { toast } from "sonner";
import { graphql } from "gql.tada";
import { Trash2 } from "lucide-react";
import { getClient } from "@/lib/gql";
import { domToPng } from "modern-screenshot";
import { Menu } from "@/app/components/menu";
import { useState, useCallback } from "react";

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

const DELETE_MESSAGE_MUTATION = graphql(`
  mutation DeleteMessage($id: String!) {
    deleteMessage(id: $id)
  }
`);

export function ReceivedMessageMenu({ id }: { id: string }) {
  const [isDeleted, setIsDeleted] = useState(false);
  const [open, setOpen] = useState(false);

  const onSaveImage = useCallback(() => {
    const target = document.querySelector(`#${id}`);

    if (!target) {
      toast.error("An error occured");
      return;
    }

    toast.promise(
      domToPng(target, {
        quality: 1,
        scale: 4,
        backgroundColor: "#111113",
        style: {
          scale: "0.9",
          display: "grid",
          placeItems: "center",
        },
      })
        .then((dataUrl) => {
          const link = document.createElement("a");
          link.download = `umamin-${id}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.log(err);
        }),
      { loading: "Saving...", success: "Download ready", error: "Error!" },
    );
  }, [id]);

  const onDelete = () => {
    getClient()
      .mutation(DELETE_MESSAGE_MUTATION, { id })
      .then((res) => {
        if (res.error) {
          toast.error("An error occured");
          return;
        }

        toast.success("Message deleted");
        setIsDeleted(true);
      });
  };

  const menuItems = [
    {
      title: "Save Image",
      onClick: onSaveImage,
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

      {isDeleted ? (
        <button
          type="button"
          onClick={() => toast.info("This message was deleted")}
        >
          <Trash2 className="h-4 w-4 text-red-700" />
        </button>
      ) : (
        <Menu menuItems={menuItems} />
      )}
    </>
  );
}

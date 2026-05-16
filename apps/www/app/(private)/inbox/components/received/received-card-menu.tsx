"use client";

import {
  type InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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
import { Menu } from "@/components/menu";
import { apiClientErrorMessage } from "@/lib/api-client";
import { blockUser, deleteMessage, unblockUser } from "@/lib/api-mutations";
import { queryKeys } from "@/lib/query";
import { removeMessage, removeMessagesBySender } from "@/lib/query-cache";
import type { MessagesResponse } from "@/lib/query-types";
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
    mutationFn: () => deleteMessage(id),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.receivedMessages(),
      });
      const previous = queryClient.getQueryData<InfiniteData<MessagesResponse>>(
        queryKeys.receivedMessages(),
      );

      queryClient.setQueryData<InfiniteData<MessagesResponse>>(
        queryKeys.receivedMessages(),
        (current) => removeMessage(current, id),
      );
      setOpen(false);

      return { previous };
    },
    onError: (err, _variables, ctx) => {
      queryClient.setQueryData(queryKeys.receivedMessages(), ctx?.previous);
      toast.error(apiClientErrorMessage(err, "Couldn't delete message."));
    },
    onSuccess: () => {
      toast.success("Message deleted.");
    },
  });

  const blockMutation = useMutation({
    mutationFn: async () => {
      if (!props.senderId) return;
      return blockUser({ userId: props.senderId });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.receivedMessages(),
      });
      const previous = queryClient.getQueryData<InfiniteData<MessagesResponse>>(
        queryKeys.receivedMessages(),
      );

      const senderId = props.senderId;

      if (senderId) {
        queryClient.setQueryData<InfiniteData<MessagesResponse>>(
          queryKeys.receivedMessages(),
          (current) => removeMessagesBySender(current, senderId),
        );
      }
      setBlockOpen(false);

      return { previous };
    },
    onSuccess: (_result, _variables, ctx) => {
      toast.success("User blocked.", {
        action: {
          label: "Undo",
          onClick: () => {
            if (props.senderId) {
              queryClient.setQueryData(
                queryKeys.receivedMessages(),
                ctx?.previous,
              );
              unblockUser({ userId: props.senderId }).catch((err) => {
                console.error(err);
                toast.error(
                  apiClientErrorMessage(err, "Couldn't unblock user."),
                );
              });
            }
          },
        },
      });
    },
    onError: (err, _variables, ctx) => {
      queryClient.setQueryData(queryKeys.receivedMessages(), ctx?.previous);
      toast.error(apiClientErrorMessage(err, "Couldn't block user."));
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

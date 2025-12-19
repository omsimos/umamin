"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SelectUser } from "@umamin/db/schema/user";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";
import { Loader2Icon, ScanFaceIcon, SendIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createCommentAction } from "@/app/actions/post";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import type { CommentData } from "@/types/post";

type Props = {
  user: SelectUser;
  postId: string;
};

type CommentsResponse = {
  data: CommentData[];
  nextCursor: string | null;
};

export default function ReplyForm({ user, postId }: Props) {
  const [content, setContent] = useState("");
  const inputRef = useDynamicTextarea(content);
  const queryClient = useQueryClient();
  const author = useMemo(() => {
    const { passwordHash: _passwordHash, ...rest } = user;
    return rest;
  }, [user]);

  const mutation = useMutation({
    mutationFn: (nextContent: string) =>
      createCommentAction({ content: nextContent, postId }),
    onMutate: async (nextContent) => {
      await queryClient.cancelQueries({ queryKey: ["post-comments", postId] });

      const previous = queryClient.getQueryData<InfiniteData<CommentsResponse>>(
        ["post-comments", postId],
      );

      const optimistic: CommentData = {
        id: `optimistic-${crypto.randomUUID()}`,
        postId,
        authorId: user.id,
        content: nextContent,
        createdAt: new Date(),
        updatedAt: new Date(),
        upvoteCount: 0,
        author,
      };

      if (previous) {
        queryClient.setQueryData<InfiniteData<CommentsResponse>>(
          ["post-comments", postId],
          {
            ...previous,
            pages: [
              {
                ...previous.pages[0],
                data: [optimistic, ...previous.pages[0].data],
              },
              ...previous.pages.slice(1),
            ],
          },
        );
      } else {
        queryClient.setQueryData<InfiniteData<CommentsResponse>>(
          ["post-comments", postId],
          {
            pageParams: [null],
            pages: [{ data: [optimistic], nextCursor: null }],
          },
        );
      }

      setContent("");
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["post-comments", postId], ctx.previous);
      }
      toast.error("Failed to create comment. Please try again.");
    },
    onSuccess: (res) => {
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Comment created successfully!");
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["post-comments", postId] });
    },
  });

  const handleSubmit: React.FormEventHandler = async (e) => {
    e.preventDefault();

    if (!content.trim()) return;
    mutation.mutate(content);
  };

  return (
    <div className="flex gap-3 w-full bg-background">
      <Avatar>
        <AvatarImage src={user.imageUrl ?? ""} alt="User avatar" />
        <AvatarFallback>
          <ScanFaceIcon />
        </AvatarFallback>
      </Avatar>
      <form
        onSubmit={handleSubmit}
        className="flex items-center space-x-2 w-full self-center"
      >
        <Textarea
          id="message"
          required
          ref={inputRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
          }}
          maxLength={500}
          placeholder="Leave a reply..."
          className="focus-visible:ring-transparent text-sm resize-none min-h-10 max-h-20 bg-muted/50 caret-pink-300"
          autoComplete="off"
        />
        <Button
          data-testid="note-send-reply-btn"
          type="submit"
          size="icon"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2Icon className="w-4 h-4 animate-spin" />
          ) : (
            <SendIcon className="h-4 w-4" />
          )}
          <span className="sr-only">SendIcon</span>
        </Button>
      </form>
    </div>
  );
}

"use client";

import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer/async-rate-limiter";
import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { queryKeys } from "@/lib/query";
import {
  patchPostAcrossFeed,
  patchPostResponse,
  prependComment,
  replaceComment,
} from "@/lib/query-cache";
import type {
  CommentsResponse,
  FeedResponse,
  PostResponse,
} from "@/lib/query-types";
import type { CommentData } from "@/types/post";
import type { PublicUser } from "@/types/user";

type Props = {
  user: PublicUser;
  postId: string;
};

export default function ReplyForm({ user, postId }: Props) {
  const [content, setContent] = useState("");
  const inputRef = useDynamicTextarea(content);
  const queryClient = useQueryClient();
  const author = useMemo(() => user, [user]);

  const rateLimitedComment = useAsyncRateLimitedCallback(createCommentAction, {
    limit: 2,
    window: 60000, // 1 minute
    windowType: "sliding",
    onReject: () => {
      throw new Error("You're replying too fast. Please wait a bit.");
    },
  });

  const mutation = useMutation({
    mutationFn: async (nextContent: string) => {
      const res = await rateLimitedComment({ content: nextContent, postId });
      if (res?.error) {
        throw new Error(res.error);
      }
      return res;
    },
    onMutate: async (nextContent) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.postComments(postId),
      });

      const previous = queryClient.getQueryData<InfiniteData<CommentsResponse>>(
        queryKeys.postComments(postId),
      );
      const previousPosts = queryClient.getQueryData<
        InfiniteData<FeedResponse>
      >(queryKeys.posts());
      const previousPost = queryClient.getQueryData<PostResponse>(
        queryKeys.post(postId),
      );

      const optimistic: CommentData = {
        id: `optimistic-${crypto.randomUUID()}`,
        postId,
        authorId: user.id,
        content: nextContent,
        createdAt: new Date(),
        updatedAt: new Date(),
        likeCount: 0,
        author,
      };

      queryClient.setQueryData<InfiniteData<CommentsResponse>>(
        queryKeys.postComments(postId),
        prependComment(previous, optimistic),
      );
      queryClient.setQueryData<InfiniteData<FeedResponse>>(
        queryKeys.posts(),
        (current) =>
          patchPostAcrossFeed(current, postId, (post) => ({
            ...post,
            commentCount: post.commentCount + 1,
          })),
      );
      queryClient.setQueryData<PostResponse>(
        queryKeys.post(postId),
        (current) =>
          patchPostResponse(current, (post) => ({
            ...post,
            commentCount: post.commentCount + 1,
          })),
      );

      setContent("");
      return {
        previous,
        previousPost,
        previousPosts,
        optimisticId: optimistic.id,
      };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.postComments(postId), ctx.previous);
      }
      queryClient.setQueryData(queryKeys.posts(), ctx?.previousPosts);
      queryClient.setQueryData(queryKeys.post(postId), ctx?.previousPost);
      toast.error(err.message ?? "Couldn't add comment.");
    },
    onSuccess: (res, _vars, ctx) => {
      if (res?.error) {
        toast.error(res.error);
        return;
      }

      if (res?.comment && ctx?.optimisticId) {
        const nextComment: CommentData = {
          ...res.comment,
          author,
          isLiked: false,
        };

        queryClient.setQueryData<InfiniteData<CommentsResponse>>(
          queryKeys.postComments(postId),
          (previous) =>
            replaceComment(
              previous,
              (comment) => comment.id === ctx.optimisticId,
              nextComment,
            ),
        );
      }

      toast.success("Comment posted.");
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

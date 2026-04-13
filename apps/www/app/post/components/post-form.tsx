"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";
import { cn } from "@umamin/ui/lib/utils";
import { GlobeIcon, Loader2Icon, SendIcon } from "lucide-react";
import { type FormEventHandler, useState } from "react";
import { toast } from "sonner";
import { createPostAction } from "@/app/actions/post";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { queryKeys } from "@/lib/query";
import { prependFeedItem, replaceFeedItem } from "@/lib/query-cache";
import type { FeedResponse } from "@/lib/query-types";
import { isOlderThanOneYear } from "@/lib/utils";
import type { FeedItem, PostData } from "@/types/post";
import type { PublicUser } from "@/types/user";

type Props = {
  user: PublicUser | null;
};

export default function PostForm({ user }: Props) {
  const [content, setContent] = useState("");
  const [textAreaCount, setTextAreaCount] = useState(0);
  const inputRef = useDynamicTextarea(content);
  const queryClient = useQueryClient();
  const submitPost = useSingleFlightAction(createPostAction);

  const mutation = useMutation({
    mutationFn: async (nextContent: string) => {
      const res = await submitPost({ content: nextContent });
      if (res?.error) {
        throw new Error(res.error);
      }
      return res;
    },
    onMutate: async (nextContent) => {
      if (!user) return {};
      await queryClient.cancelQueries({ queryKey: queryKeys.posts() });

      const previous = queryClient.getQueryData<InfiniteData<FeedResponse>>(
        queryKeys.posts(),
      );

      const optimisticPost: PostData = {
        id: `optimistic-${crypto.randomUUID()}`,
        content: nextContent,
        authorId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
        likeCount: 0,
        commentCount: 0,
        repostCount: 0,
        author: user,
        isLiked: false,
        isReposted: false,
      };
      const optimistic: FeedItem = { type: "post", post: optimisticPost };

      queryClient.setQueryData<InfiniteData<FeedResponse>>(
        queryKeys.posts(),
        prependFeedItem(previous, optimistic),
      );

      setContent("");
      setTextAreaCount(0);
      return { previous, optimisticId: optimisticPost.id };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.posts(), ctx.previous);
      }
      toast.error(err.message ?? "Couldn't post.");
    },
    onSuccess: (res, _vars, ctx) => {
      if (res?.error) {
        toast.error(res.error);
        return;
      }

      if (user && res?.post && ctx?.optimisticId) {
        const nextItem: FeedItem = {
          type: "post",
          post: {
            ...res.post,
            author: user,
            isLiked: false,
            isReposted: false,
          },
        };

        queryClient.setQueryData<InfiniteData<FeedResponse>>(
          queryKeys.posts(),
          (previous) =>
            replaceFeedItem(
              previous,
              (item) =>
                item.type === "post" && item.post.id === ctx.optimisticId,
              nextItem,
            ),
        );
      }

      toast.success("Post published.");
    },
  });

  const handleSubmit: FormEventHandler = async (e) => {
    e.preventDefault();

    if (!content.trim()) return;
    mutation.mutate(content);
  };

  return (
    <section>
      <form
        onSubmit={handleSubmit}
        className="mb-8 flex gap-3 items-start container"
      >
        <Avatar
          className={cn("mt-1", {
            "avatar-shine": isOlderThanOneYear(user?.createdAt),
          })}
        >
          <AvatarImage src={user?.imageUrl ?? ""} alt="User avatar" />
          <AvatarFallback>
            {user?.username ? user.username.slice(0, 2).toUpperCase() : "UM"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <Textarea
            id="message"
            required
            ref={inputRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setTextAreaCount(e.target.value.length);
            }}
            placeholder="How's your day going?"
            className="focus-visible:ring-transparent text-base lg:max-h-100 max-h-62.5 dark:bg-transparent px-0 border-0 shadow-none caret-pink-300"
            autoComplete="off"
          />

          <div className="mt-3 flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-muted">
                <GlobeIcon className="h-3.5 w-3.5" />
                Public
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  textAreaCount > 500 ? "text-red-500" : "text-zinc-500",
                  "text-sm",
                )}
              >
                {textAreaCount >= 450 ? 500 - textAreaCount : null}
              </span>

              <Button
                data-testid="share-post-btn"
                disabled={
                  mutation.isPending ||
                  !content ||
                  textAreaCount > 500 ||
                  textAreaCount === 0
                }
                type="submit"
              >
                {mutation.isPending ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  <SendIcon />
                )}
                <p>Submit Post</p>
              </Button>
            </div>
          </div>
        </div>
      </form>
    </section>
  );
}

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
import { cn } from "@umamin/ui/lib/utils";
import { GlobeIcon, Loader2Icon, SendIcon } from "lucide-react";
import posthog from "posthog-js";
import { type FormEventHandler, useState } from "react";
import { toast } from "sonner";
import { createPostAction } from "@/app/actions/post";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { isOlderThanOneYear } from "@/lib/utils";
import type { FeedItem, PostData } from "@/types/post";
import type { PublicUser } from "@/types/user";

type PostsResponse = {
  data: FeedItem[];
  nextCursor: string | null;
};

type Props = {
  user: PublicUser | null;
};

export default function PostForm({ user }: Props) {
  const [content, setContent] = useState("");
  const [textAreaCount, setTextAreaCount] = useState(0);
  const inputRef = useDynamicTextarea(content);
  const queryClient = useQueryClient();

  const rateLimitedPost = useAsyncRateLimitedCallback(createPostAction, {
    limit: 2,
    window: 60000, // 1 minute
    windowType: "sliding",
    onReject: () => {
      throw new Error("You're posting too fast. Please wait a bit.");
    },
  });

  const mutation = useMutation({
    mutationFn: async (nextContent: string) => {
      const res = await rateLimitedPost({ content: nextContent });
      if (res?.error) {
        throw new Error(res.error);
      }
      return res;
    },
    onMutate: async (nextContent) => {
      if (!user) return {};
      await queryClient.cancelQueries({ queryKey: ["posts"] });

      const previous = queryClient.getQueryData<InfiniteData<PostsResponse>>([
        "posts",
      ]);

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

      if (previous) {
        queryClient.setQueryData<InfiniteData<PostsResponse>>(["posts"], {
          ...previous,
          pages: [
            {
              ...previous.pages[0],
              data: [optimistic, ...previous.pages[0].data],
            },
            ...previous.pages.slice(1),
          ],
        });
      } else {
        queryClient.setQueryData<InfiniteData<PostsResponse>>(["posts"], {
          pageParams: [null],
          pages: [{ data: [optimistic], nextCursor: null }],
        });
      }

      setContent("");
      setTextAreaCount(0);
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["posts"], ctx.previous);
      }
      toast.error(err.message ?? "Couldn't post.");

      // Track post creation failure
      posthog.capture("post_creation_failed", {
        error: err.message,
      });
    },
    onSuccess: (res, vars) => {
      if (res?.error) {
        toast.error(res.error);
        posthog.capture("post_creation_failed", {
          error: res.error,
        });
      } else {
        toast.success("Post published.");

        // Track post created
        posthog.capture("post_created", {
          post_length: vars.length,
          author_username: user?.username,
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
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

"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";
import { cn } from "@umamin/ui/lib/utils";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { type FormEventHandler, useState } from "react";
import { toast } from "sonner";
import { createPostAction } from "@/app/actions/post";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
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

  const mutation = useMutation({
    mutationFn: (nextContent: string) =>
      createPostAction({ content: nextContent }),
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
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(["posts"], ctx.previous);
      }
      toast.error("Failed to create post. Please try again.");
    },
    onSuccess: (res) => {
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Post created successfully!");
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
        className="mb-8 flex flex-col gap-y-4 items-end container"
      >
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
          className="focus-visible:ring-transparent text-base lg:max-h-100 max-h-62.5 bg-card caret-pink-300"
          autoComplete="off"
        />
        <div className="space-x-3">
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
            <p>Publish Post</p>
            {mutation.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <SparklesIcon />
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

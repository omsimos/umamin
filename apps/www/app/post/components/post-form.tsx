"use client";

import { Button } from "@umamin/ui/components/button";
import { Textarea } from "@umamin/ui/components/textarea";
import { cn } from "@umamin/ui/lib/utils";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { type FormEventHandler, useState } from "react";
import { toast } from "sonner";
import { createPostAction } from "@/app/actions/post";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";

export default function PostForm() {
  const [content, setContent] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [textAreaCount, setTextAreaCount] = useState(0);
  const inputRef = useDynamicTextarea(content);

  const handleSubmit: FormEventHandler = async (e) => {
    e.preventDefault();

    try {
      setIsFetching(true);
      const res = await createPostAction({ content });
      if (res.error) {
        throw new Error(res.error);
      }
      toast.success("Post created successfully!");
    } catch (err) {
      toast.error("Failed to create post. Please try again.");
      console.log(err);
    } finally {
      setIsFetching(false);
      setContent("");
    }
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
              isFetching ||
              !content ||
              textAreaCount > 500 ||
              textAreaCount === 0
            }
            type="submit"
          >
            <p>Publish Post</p>
            {isFetching ? (
              <Loader2Icon className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <SparklesIcon className="h-4 w-4 ml-2" />
            )}
          </Button>
        </div>
      </form>
    </section>
  );
}

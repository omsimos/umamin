"use client";

import { Loader2, Sparkles } from "lucide-react";
import { FormEventHandler, useState } from "react";

import { cn } from "@umamin/ui/lib/utils";
import { Label } from "@umamin/ui/components/label";
import { Button } from "@umamin/ui/components/button";
import { Switch } from "@umamin/ui/components/switch";
import { Textarea } from "@umamin/ui/components/textarea";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";

export default function PostForm() {
  const [content, setContent] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [textAreaCount, setTextAreaCount] = useState(0);
  const inputRef = useDynamicTextarea(content);

  const handleSubmit: FormEventHandler = (e) => {
    e.preventDefault();

    setIsFetching(true);
    setTimeout(() => {
      setIsFetching(false);
      setContent("");
    }, 500);
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
          className="focus-visible:ring-transparent text-base lg:max-h-[400px] max-h-[250px] bg-card caret-pink-300"
          autoComplete="off"
        />
        <div className="flex w-full justify-between items-center">
          <div className="flex items-center space-x-2 text-sm">
            <Switch
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
              id="airplane-mode"
            />
            <Label
              htmlFor="airplane-mode"
              className={isAnonymous ? "" : "text-muted-foreground"}
            >
              Anonymous
            </Label>
          </div>

          <div className="space-x-3">
            <span
              className={cn(
                textAreaCount > 500 ? "text-red-500" : "text-zinc-500",
                "text-sm"
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
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Sparkles className="h-4 w-4 ml-2" />
              )}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

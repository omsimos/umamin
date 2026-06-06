"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Badge } from "@umamin/ui/components/badge";
import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@umamin/ui/components/dialog";
import { Textarea } from "@umamin/ui/components/textarea";
import { cn } from "@umamin/ui/lib/utils";
import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { type FormEventHandler, useRef, useState } from "react";
import { toast } from "sonner";
import { ComposerImages } from "@/components/composer-images";
import { QuotedPostCard } from "@/components/quoted-post-card";
import { useCreatePost } from "@/hooks/use-create-post";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { useImageAttachments } from "@/hooks/use-image-attachments";
import {
  MAX_POST_IMAGES,
  PLUS_REQUIRED_ERROR,
  postImagesEnabled,
} from "@/lib/post-images";
import { PRIVATE_STALE_TIME, queryKeys } from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { hasUmaminPlus } from "@/lib/utils";
import type { QuotedPostData } from "@/types/post";

type ComposeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Present = quote composer: the card previews under the text and the
  // created post references it.
  quotedPost?: QuotedPostData;
};

// The shared post composer (FAB on /feed + the Quote action on any post card).
// Sources the current user from the cached query itself so call sites don't
// have to thread it through.
export function ComposeDialog({
  open,
  onOpenChange,
  quotedPost,
}: ComposeDialogProps) {
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
  });
  const user = currentUser?.user ?? null;

  const [dragging, setDragging] = useState(false);
  const [content, setContent] = useState("");
  const inputRef = useDynamicTextarea(content);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { submitPost, isPending } = useCreatePost(user);
  const attachments = useImageAttachments();

  const isPlus = hasUmaminPlus(user?.createdAt);
  const imagesAvailable = postImagesEnabled();

  const count = content.length;
  const overLimit = count > 500;
  // Image-only posts are allowed; posting waits for in-flight uploads and
  // blocks on failed tiles so an image the user can see is never silently
  // dropped from the published post.
  const canPost =
    !isPending &&
    !attachments.isBusy &&
    !attachments.hasErrors &&
    !overLimit &&
    (content.trim().length > 0 || attachments.hasReadyImages);

  const handleSubmit: FormEventHandler = async (e) => {
    e.preventDefault();
    if (!canPost) return;

    const images = attachments.readyImages();

    try {
      await submitPost({
        content,
        images: images.length > 0 ? images : undefined,
        quotedPostId: quotedPost?.id,
        quotedPost,
        optimisticImages: attachments.items.flatMap((item) =>
          item.status === "ready" && item.key
            ? [
                {
                  key: item.key,
                  width: item.width,
                  height: item.height,
                  previewUrl: item.previewUrl,
                },
              ]
            : [],
        ),
      });
      setContent("");
      attachments.resetAfterPost();
      onOpenChange(false);
    } catch {
      // onError already toasted + rolled back; keep the dialog open to retry.
    }
  };

  const handlePickImages = () => {
    if (!isPlus) {
      toast.info(PLUS_REQUIRED_ERROR);
      return;
    }
    fileInputRef.current?.click();
  };

  const acceptFiles = (files: Iterable<File>) => {
    if (!isPlus) return;
    attachments.addFiles(files);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-dvh max-w-xl flex-col gap-0 p-0 sm:h-auto sm:max-h-[80dvh] sm:rounded-xl"
        onDragOver={(e) => {
          if (!imagesAvailable) return;
          e.preventDefault();
          if (isPlus) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!imagesAvailable) return;
          e.preventDefault();
          setDragging(false);
          acceptFiles(e.dataTransfer.files);
        }}
      >
        <DialogTitle className="sr-only">
          {quotedPost ? "Quote post" : "Create post"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {quotedPost ? "Write a quote post" : "Write a new post"}
        </DialogDescription>

        {dragging && (
          <div className="pointer-events-none absolute inset-1 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-pink-500 bg-background/80">
            <span className="text-sm font-medium text-pink-500">
              Drop images to attach
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Cancel"
            >
              <XIcon />
            </Button>

            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "text-sm",
                  overLimit ? "text-red-500" : "text-zinc-500",
                )}
              >
                {count >= 450 ? 500 - count : null}
              </span>
              <Button
                type="submit"
                disabled={!canPost}
                className="rounded-full px-5"
              >
                {isPending || attachments.isBusy ? (
                  <Loader2Icon className="animate-spin" />
                ) : (
                  "Post"
                )}
              </Button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 gap-3 overflow-y-auto px-4 py-4">
            <Avatar
              className={cn("mt-1", {
                "avatar-shine": isPlus,
              })}
            >
              <AvatarImage src={user?.imageUrl ?? ""} alt="User avatar" />
              <AvatarFallback>
                {user?.username
                  ? user.username.slice(0, 2).toUpperCase()
                  : "UM"}
              </AvatarFallback>
            </Avatar>

            <div className="flex min-w-0 flex-1 flex-col gap-3">
              <Textarea
                id="compose"
                autoFocus
                ref={inputRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={(e) => {
                  const files = e.clipboardData?.files;
                  if (imagesAvailable && isPlus && files?.length) {
                    e.preventDefault();
                    acceptFiles(files);
                  }
                }}
                placeholder={
                  quotedPost ? "Add a comment" : "How's your day going?"
                }
                className="flex-1 resize-none border-0 px-0 text-base shadow-none caret-pink-300 focus-visible:ring-transparent dark:bg-transparent"
                autoComplete="off"
              />

              <ComposerImages
                items={attachments.items}
                onRemove={attachments.remove}
                onRetry={attachments.retry}
              />

              {quotedPost && (
                <QuotedPostCard post={quotedPost} linked={false} />
              )}
            </div>
          </div>

          {imagesAvailable && (
            <footer className="flex items-center gap-1 border-t px-3 py-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={MAX_POST_IMAGES > 1}
                hidden
                onChange={(e) => {
                  if (e.target.files) acceptFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Add image"
                onClick={handlePickImages}
                disabled={attachments.items.length >= MAX_POST_IMAGES}
                className="text-pink-500 hover:text-pink-600"
              >
                <ImagePlusIcon className="size-5" />
              </Button>
              {!isPlus && (
                <Badge variant="secondary" className="text-muted-foreground">
                  Requires Umamin+
                </Badge>
              )}
              {attachments.hasErrors && (
                <span role="status" className="text-xs text-red-500">
                  Retry or remove the failed image to post.
                </span>
              )}
            </footer>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

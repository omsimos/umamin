"use client";

import { Button } from "@umamin/ui/components/button";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { PostMenu } from "@/app/(public)/feed/components/post-menu";

type Props = {
  postId: string;
  authorId: string;
  imageId: string;
  isAuthenticated: boolean;
  currentUserId?: string;
};

// Focused-view top bar for /post: back to feed, centered title, and the post's
// menu (moved up from the card). Sticky so it stays while comments scroll.
export function PostHeader({
  postId,
  authorId,
  imageId,
  isAuthenticated,
  currentUserId,
}: Props) {
  const router = useRouter();

  const goBack = () => {
    // Prefer a real back nav (keeps feed scroll position); fall back to /feed
    // when the post was opened directly (shared link, new tab).
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/feed");
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/80 px-2 py-2 backdrop-blur">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Go back"
        onClick={goBack}
      >
        <ArrowLeftIcon className="size-5" />
      </Button>

      <h1 className="absolute left-1/2 -translate-x-1/2 font-semibold">Post</h1>

      {isAuthenticated ? (
        <PostMenu
          postId={postId}
          authorId={authorId}
          imageId={imageId}
          isAuthenticated={isAuthenticated}
          currentUserId={currentUserId}
        />
      ) : (
        <span aria-hidden className="size-9" />
      )}
    </header>
  );
}

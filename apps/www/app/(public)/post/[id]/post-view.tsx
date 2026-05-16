"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { AlertCircleIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { PostCardMain } from "@/app/(public)/feed/components/post-card-main";
import { PostCardSkeleton } from "@/app/(public)/feed/components/post-card-skeleton";
import { useSession } from "@/hooks/use-session";
import {
  PUBLIC_STALE_TIME,
  pageQueryOptions,
  queryKeys,
  queryScope,
} from "@/lib/query";
import { queryErrorMessage } from "@/lib/query-errors";
import { fetchPost } from "@/lib/query-fetchers";
import { toPublicUser } from "@/types/user";
import { CommentsList } from "../components/comments-list";
import ReplyForm from "../components/reply-form";

export function PostView({ id }: { id: string }) {
  const { data: session } = useSession();
  const user = session?.user ?? null;
  const isAuthenticated = !!user;
  const scope = queryScope(isAuthenticated);
  const currentUser = user ? toPublicUser(user) : null;

  const {
    data: post,
    isPending,
    error,
  } = useQuery({
    ...pageQueryOptions(
      queryKeys.post(id, scope),
      () => fetchPost(id, isAuthenticated),
      PUBLIC_STALE_TIME,
    ),
  });

  if (isPending) {
    return <PostCardSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertTitle>Couldn't load post</AlertTitle>
        <AlertDescription>
          {queryErrorMessage(error, "Please try again later.")}
        </AlertDescription>
      </Alert>
    );
  }

  if (!post) {
    notFound();
  }

  return (
    <>
      <PostCardMain
        isAuthenticated={isAuthenticated}
        currentUserId={user?.id}
        data={post}
      />

      {currentUser && (
        <div className="w-full py-4 border-b font-medium text-muted-foreground px-7 sm:px-0">
          <ReplyForm user={currentUser} postId={id} />
        </div>
      )}

      <div className="space-y-6 my-6">
        <CommentsList isAuthenticated={isAuthenticated} postId={id} />
      </div>
    </>
  );
}

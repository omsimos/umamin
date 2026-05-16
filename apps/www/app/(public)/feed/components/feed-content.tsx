"use client";

import { useSession } from "@/hooks/use-session";
import { toPublicUser } from "@/types/user";
import PostForm from "../../post/components/post-form";
import { PostList } from "./post-list";

export function FeedContent() {
  const { data } = useSession();
  const user = data?.user ?? null;
  const publicUser = user ? toPublicUser(user) : null;

  return (
    <>
      {user && <PostForm user={publicUser} />}

      <div className="border-y space-y-6 pt-6">
        <PostList isAuthenticated={!!user} currentUserId={user?.id} />
      </div>
    </>
  );
}

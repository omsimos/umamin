import { getSession } from "@/lib/auth";
import PostForm from "../post/components/post-form";
import { PostList } from "./components/post-list";

export default async function Feed() {
  const { user } = await getSession();
  const publicUser = user
    ? (({ passwordHash: _pw, ...rest }) => rest)(user)
    : null;

  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        {user && <PostForm user={publicUser} />}

        <div className="border-y space-y-6 pt-6">
          <PostList isAuthenticated={!!user} currentUserId={user?.id} />
        </div>
      </section>
    </main>
  );
}

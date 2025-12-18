import PostForm from "../post/components/post-form";
import { PostList } from "./components/post-list";

export default function Feed() {
  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        <PostForm />

        <div className="border-y space-y-6 pt-6 bg-muted/20 sm:rounded-md sm:border-x">
          <PostList />
        </div>
      </section>
    </main>
  );
}

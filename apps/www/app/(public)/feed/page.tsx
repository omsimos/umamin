import { redirect } from "next/navigation";
import { FeedContent } from "./components/feed-content";

export default function Feed() {
  if (process.env.NEXT_PUBLIC_SOCIAL_UNDER_MAINTENANCE === "true") {
    redirect("/social");
  }

  return (
    <main className="pb-40">
      <section className="pt-6 w-full max-w-xl mx-auto bg-background border-muted">
        <FeedContent />
      </section>
    </main>
  );
}

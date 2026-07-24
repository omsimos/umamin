import { createFileRoute } from "@tanstack/react-router";
import Privacy from "@/markdown/privacy.mdx";

const title = "Umamin — Privacy Policy";
const description =
  "Learn how Umamin, an open-source platform for sending and receiving encrypted anonymous messages, collects, uses, and protects your personal information.";

export const Route = createFileRoute("/_public/privacy")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-(--breakpoint-md) container min-h-screen lg:mt-12 pb-24">
      <Privacy />
    </div>
  );
}

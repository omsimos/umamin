import { createFileRoute } from "@tanstack/react-router";
import { pageSeo } from "@/lib/seo";
import Privacy from "@/markdown/privacy.mdx";

const title = "Privacy Policy | Umamin";
const description =
  "Learn how Umamin, a Filipino social media built around anonymity, collects, uses, and protects your personal information.";

export const Route = createFileRoute("/_public/privacy")({
  head: () => pageSeo({ title, description, path: "/privacy" }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-(--breakpoint-md) container min-h-screen lg:mt-12 pb-24">
      <Privacy />
    </div>
  );
}

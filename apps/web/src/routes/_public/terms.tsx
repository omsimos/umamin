import { createFileRoute } from "@tanstack/react-router";
import { pageSeo } from "@/lib/seo";
import TermsOfService from "@/markdown/terms.mdx";

const title = "Umamin — Terms of Service";
const description =
  "Understand the terms and conditions for using Umamin, an open-source platform for sending and receiving encrypted anonymous messages.";

export const Route = createFileRoute("/_public/terms")({
  head: () => pageSeo({ title, description, path: "/terms" }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-(--breakpoint-md) container min-h-screen lg:mt-12 pb-24">
      <TermsOfService />
    </div>
  );
}

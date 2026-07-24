import { createFileRoute } from "@tanstack/react-router";
import ChildSafety from "@/markdown/child-safety.mdx";

const title = "Umamin — Child Safety Standards";
const description =
  "Umamin's standards against child sexual abuse and exploitation (CSAE): what is prohibited, how we prevent and respond to it, how to report, and our child safety point of contact.";

export const Route = createFileRoute("/_public/child-safety")({
  head: () => ({
    meta: [{ title }, { name: "description", content: description }],
    links: [{ rel: "canonical", href: "https://www.umamin.link/child-safety" }],
  }),
  component: ChildSafetyPage,
});

function ChildSafetyPage() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-(--breakpoint-md) container min-h-screen lg:mt-12 pb-24">
      <ChildSafety />
    </div>
  );
}

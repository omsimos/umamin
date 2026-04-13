import type { Metadata } from "next";
import Privacy from "@/markdown/privacy.mdx";

export const metadata: Metadata = {
  title: "Umamin — Privacy Policy",
  description:
    "Learn how Umamin, an open-source platform for sending and receiving encrypted anonymous messages, collects, uses, and protects your personal information.",
};

export default function Page() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-(--breakpoint-md) container min-h-screen lg:mt-12 pb-24">
      <Privacy />
    </div>
  );
}

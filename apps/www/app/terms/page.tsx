import type { Metadata } from "next";
import TermsOfService from "@/markdown/terms.mdx";

export const metadata: Metadata = {
  title: "Umamin — Terms of Service",
  description:
    "Understand the terms and conditions for using Umamin, an open-source platform for sending and receiving encrypted anonymous messages.",
};

export default function Page() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-(--breakpoint-md) container min-h-screen lg:mt-12 pb-24">
      <TermsOfService />
    </div>
  );
}

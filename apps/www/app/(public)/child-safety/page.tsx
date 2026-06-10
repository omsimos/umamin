import type { Metadata } from "next";
import ChildSafety from "@/markdown/child-safety.mdx";

export const metadata: Metadata = {
  title: "Umamin — Child Safety Standards",
  description:
    "Umamin's standards against child sexual abuse and exploitation (CSAE): what is prohibited, how we prevent and respond to it, how to report, and our child safety point of contact.",
  alternates: { canonical: "/child-safety" },
};

export default function Page() {
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-(--breakpoint-md) container min-h-screen lg:mt-12 pb-24">
      <ChildSafety />
    </div>
  );
}

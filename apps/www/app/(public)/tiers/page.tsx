import type { Metadata } from "next";
import { TiersView } from "./tiers-view";

export const metadata: Metadata = {
  title: "Umamin — Plus",
  description:
    "What you unlock on Free, Plus, and Premium. Plus is always free — early access to new features.",
  robots: { index: false, follow: false },
};

export default function TiersPage() {
  return (
    <section className="mx-auto min-h-screen w-full max-w-lg container pb-24">
      <TiersView />
    </section>
  );
}

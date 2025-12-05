import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { getSession } from "@/lib/auth";
import { CurrentUserCard } from "./components/current-user-card";
import { InboxTabs } from "./components/inbox-tabs";

export const metadata: Metadata = {
  title: "Umamin — Inbox",
  description:
    "Manage your received messages securely on Umamin. View, reply, and organize your inbox.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    title: "Umamin — Inbox",
    description:
      "Manage your received messages securely on Umamin. View, reply, and organize your inbox.",
    url: "https://www.umamin.link/inbox",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin — Inbox",
    description:
      "Manage your received messages securely on Umamin. View, reply, and organize your inbox.",
  },
};

export default async function InboxPage() {
  const { session } = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="max-w-xl mx-auto min-h-screen container">
      <Suspense fallback={<UserCardSkeleton />}>
        <CurrentUserCard />
      </Suspense>

      <InboxTabs />
    </main>
  );
}

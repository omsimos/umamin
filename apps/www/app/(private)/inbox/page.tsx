import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { AuthGuard } from "@/components/auth-guard";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
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

export default function InboxPage() {
  return (
    <main className="max-w-xl mx-auto min-h-screen container">
      <AuthGuard fallback={<UserCardSkeleton />}>
        <Suspense fallback={<UserCardSkeleton />}>
          <CurrentUserCard />
        </Suspense>

        <InboxTabs />

        {/* v2-user */}
        <ClientOnlyAdContainer className="mt-5" placement="profile_bottom" />
      </AuthGuard>
    </main>
  );
}

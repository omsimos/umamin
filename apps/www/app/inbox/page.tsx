import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { getSession } from "@/lib/auth";
import { CurrentUserCard } from "./components/current-user-card";
import { ReceivedMessages } from "./components/received/received-messages";
import { SentMessages } from "./components/sent/sent-messages";

const AdContainer = dynamic(() => import("@/components/ad-container"));

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

      <Tabs defaultValue="received" className="w-full mt-4">
        <TabsList className="w-full bg-transparent flex mb-5">
          <TabsTrigger
            value="received"
            className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-r-none font-semibold"
          >
            Received
          </TabsTrigger>
          <TabsTrigger
            value="sent"
            className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-l-none font-semibold"
          >
            Sent
          </TabsTrigger>
        </TabsList>

        {/* v2-inbox */}
        <AdContainer className="mb-4" slotId="7047998078" />

        <TabsContent value="received">
          <ReceivedMessages />
        </TabsContent>

        <TabsContent value="sent">
          <SentMessages />
        </TabsContent>
      </Tabs>
    </main>
  );
}

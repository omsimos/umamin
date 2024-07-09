import { Suspense } from "react";
import dynamic from "next/dynamic";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import { UserCard } from "../components/user-card";
import { SentMessages } from "./components/sent/messages";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { ReceivedMessages } from "./components/received/messages";

const AdContainer = dynamic(() => import("@umamin/ui/ad"));

export const metadata = {
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

export default async function UserProfile() {
  const { user, session } = await getSession();

  if (!user) {
    redirect("/login");
  }

  const tabsData = [
    {
      name: "Received",
      content: () => (
        <Suspense
          fallback={
            <div className="space-y-5 container">
              <Skeleton className="w-full h-[200px] rounded-lg" />
              <Skeleton className="w-full h-[200px] rounded-lg" />
              <Skeleton className="w-full h-[200px] rounded-lg" />
            </div>
          }
        >
          <ReceivedMessages sessionId={session.id} />
        </Suspense>
      ),
    },
    {
      name: "Sent",
      content: () => (
        <Suspense
          fallback={
            <div className="space-y-5 container">
              <Skeleton className="w-full h-[300px] rounded-lg" />
              <Skeleton className="w-full h-[300px] rounded-lg" />
              <Skeleton className="w-full h-[300px] rounded-lg" />
            </div>
          }
        >
          <SentMessages sessionId={session.id} />
        </Suspense>
      ),
    },
  ];

  return (
    <main className="max-w-xl mx-auto space-y-8 lg:mt-36 mt-28 pb-24">
      <UserCard {...user} />

      <Tabs defaultValue="Received" className="w-full">
        <TabsList className="w-full bg-transparent sm:px-4 px-0 flex mb-5">
          {tabsData.map((tab) => (
            <TabsTrigger
              key={tab.name}
              value={tab.name}
              className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-none font-semibold"
            >
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* v2-inbox */}
        <AdContainer className="mb-5" slotId="7047998078" />

        {tabsData.map((tab) => (
          <TabsContent key={tab.name} value={tab.name}>
            {tab.content()}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}

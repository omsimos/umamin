"use client";

import { Suspense } from "react";
import { graphql } from "gql.tada";
import { useRouter } from "next/navigation";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import { useQuery } from "@urql/next";
import { UserCard } from "../components/user-card";
import { Skeleton } from "@umamin/ui/components/skeleton";
import { SentMessages } from "./components/sent-messages";
import { RecentMessages } from "./components/recent-messages";

const currentUserQuery = graphql(`
  query CurrentUser {
    currentUser {
      __typename
      id
      bio
      username
      imageUrl
      createdAt
    }
  }
`);

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-xl lg:mt-36 mt-28 mx-auto ">
          <Skeleton className="w-full h-[200px] rounded-2xl" />

          <div className="space-y-5 mt-24">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="w-full h-[200px] rounded-lg" />
            ))}
          </div>
        </div>
      }
    >
      <UserProfile />
    </Suspense>
  );
}

function UserProfile() {
  const [result] = useQuery({ query: currentUserQuery });
  const router = useRouter();

  const tabsData = [
    {
      name: "Recent",
      value: "recent",
      content: () => <RecentMessages userId={user?.id!} />,
    },
    {
      name: "Sent",
      value: "sent",
      content: () => <SentMessages userId={user?.id!} />,
    },
  ];

  const user = result.data?.currentUser;

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <main className="container max-w-xl space-y-3 lg:mt-36 mt-28">
      {user && (
        <UserCard
          id={user.id}
          bio={user.bio}
          username={user.username}
          imageUrl={user.imageUrl}
          createdAt={user.createdAt}
        />
      )}

      <Tabs defaultValue="recent" className="w-full">
        <TabsList className="w-full bg-transparent px-0 flex mb-5">
          {tabsData.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-none font-semibold"
            >
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabsData.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.content()}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}

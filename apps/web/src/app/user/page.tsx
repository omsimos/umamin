import { graphql } from "gql.tada";
import { redirect } from "next/navigation";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import { getClient } from "@/lib/gql";
import { getSession } from "@/lib/auth";
import { UserCard } from "./components/user-card";
import { SentMessages } from "./components/sent-messages";
import { RecentMessages } from "./components/recent-messages";

const UserByIdQuery = graphql(`
  query UserById($id: String!) {
    userById(id: $id) {
      __typename
      id
      bio
      username
      imageUrl
      createdAt
    }
  }
`);

export default async function UserProfile() {
  const { session } = await getSession();

  if (!session) {
    redirect("/login");
  }

  const result = await getClient().query(UserByIdQuery, {
    id: session?.userId,
  });

  const user = result.data?.userById;

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

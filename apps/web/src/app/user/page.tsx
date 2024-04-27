import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import { getSession } from "@/lib/auth";
import { UserCard } from "./components/user-card";
import { SentMessages } from "./components/sent-messages";
import { RecentMessages } from "./components/recent-messages";

export default async function UserProfile() {
  const { user } = await getSession();

  const tabsData = [
    {
      name: "📥 Recent",
      value: "recent",
      content: () => <RecentMessages />,
    },
    {
      name: "📩 Sent",
      value: "sent",
      content: () => <SentMessages />,
    },
  ];

  return (
    <main className="container max-w-xl space-y-3 lg:mt-36 mt-28">
      {user && <UserCard {...user} />}

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

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
import { ReceivedMessages } from "./components/received/messages";

export default async function UserProfile() {
  const { user } = await getSession();

  if (!user) {
    redirect("/login");
  }

  const tabsData = [
    {
      name: "Received",
      content: () => <ReceivedMessages userId={user.id} />,
    },
    {
      name: "Sent",
      content: () => <SentMessages userId={user.id} />,
    },
  ];

  return (
    <main className="container max-w-xl space-y-3 lg:mt-36 mt-28 pb-24">
      <UserCard {...user} />

      <Tabs defaultValue="Received" className="w-full">
        <TabsList className="w-full bg-transparent px-0 flex mb-5">
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

        {tabsData.map((tab) => (
          <TabsContent key={tab.name} value={tab.name}>
            {tab.content()}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}

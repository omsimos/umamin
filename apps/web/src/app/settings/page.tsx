import { cache } from "react";
import { redirect } from "next/navigation";

import { logout } from "@/actions";
import { getClient } from "@/lib/gql";
import { getSession } from "@/lib/auth";
import { USER_BY_ID_QUERY } from "./queries";
import { GeneralSettings } from "./components/general";
import { AccountSettings } from "./components/account";
import { SignOutButton } from "./components/sign-out-button";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";

const getUserById = cache(async (id: string) => {
  const res = await getClient().query(USER_BY_ID_QUERY, {
    id,
  });

  return res;
});

export default async function Settings() {
  const { user } = await getSession();

  if (!user) {
    redirect("/login");
  }

  const result = await getUserById(user.id);
  const userData = result.data?.userById;

  const tabsData = [
    {
      name: "General",
      content: !!userData && <GeneralSettings user={userData} />,
    },
    {
      name: "Account",
      content: !!userData && (
        <AccountSettings user={userData} pwdHash={user.passwordHash} />
      ),
    },
  ];

  return (
    <div className="w-full mx-auto max-w-lg container lg:mt-36 mt-28 min-h-screen pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl tracking-tight font-semibold">Settings</h2>
        <form action={logout}>
          <SignOutButton />
        </form>
      </div>

      <p className="text-sm text-muted-foreground">
        Manage your account settings.
      </p>

      <Tabs defaultValue="General" className="w-full mt-6">
        <TabsList className="w-full bg-transparent px-0 flex mb-8">
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
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

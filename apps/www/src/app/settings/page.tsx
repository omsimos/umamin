import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { logout } from "@/actions";
import { getClient } from "@/lib/gql/rsc";
import { getSession, lucia } from "@/lib/auth";

import { CURRENT_USER_QUERY } from "./queries";
import { GeneralSettings } from "./components/general";
import { AccountSettings } from "./components/account";
import { PrivacySettings } from "./components/privacy";
import { SignOutButton } from "./components/sign-out-button";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";

const getCurrentUser = cache(async () => {
  const sessionId = cookies().get(lucia.sessionCookieName)?.value ?? "";
  const res = await getClient(sessionId).query(CURRENT_USER_QUERY, {});

  return res;
});

export default async function Settings() {
  const { user } = await getSession();

  if (!user) {
    redirect("/login");
  }

  const result = await getCurrentUser();
  const userData = result.data?.user;

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
    {
      name: "Privacy",
      content: !!userData && <PrivacySettings user={userData} />,
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
        Manage your account settings
      </p>

      <Tabs defaultValue="General" className="w-full mt-12">
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

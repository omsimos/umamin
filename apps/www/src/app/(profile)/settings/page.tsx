import { logout } from "@/actions";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

import { getCurrentUser } from "./queries";
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

export const metadata = {
  title: "Umamin — Settings",
  description:
    "Manage your preferences and account settings on Umamin. Customize your profile, adjust privacy settings, and control how you interact anonymously.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    title: "Umamin — Settings",
    description:
      "Manage your preferences and account settings on Umamin. Customize your profile, adjust privacy settings, and control how you interact anonymously.",
    url: "https://www.umamin.link/settings",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin — Settings",
    description:
      "Manage your preferences and account settings on Umamin. Customize your profile, adjust privacy settings, and control how you interact anonymously.",
  },
};

export default async function Settings() {
  const { user, session } = await getSession();

  if (!user) {
    redirect("/login");
  }

  const userData = await getCurrentUser(session?.id);

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

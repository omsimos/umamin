import { Metadata } from "next";
import { getSession, logout } from "@/lib/auth";
import { redirect } from "next/navigation";

import { SignOutButton } from "./components/sign-out-button";

import { GeneralSettings } from "./components/general-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountSettings } from "./components/account-settings";
import { PrivacySettings } from "./components/privacy-settings";

export const metadata: Metadata = {
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
  const { session } = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="w-full mx-auto max-w-lg container min-h-screen pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl tracking-tight font-semibold">Settings</h2>
        <form action={logout}>
          <SignOutButton />
        </form>
      </div>

      <p className="text-sm text-muted-foreground">
        Manage your account settings
      </p>

      <Tabs defaultValue="general" className="w-full mt-12">
        <TabsList className="w-full bg-transparent px-0 flex mb-8">
          <TabsTrigger
            value="general"
            className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-r-none font-semibold"
          >
            General
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-none font-semibold"
          >
            Account
          </TabsTrigger>
          <TabsTrigger
            value="privacy"
            className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-l-none font-semibold"
          >
            Privacy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralSettings />
        </TabsContent>

        <TabsContent value="account">
          <AccountSettings />
        </TabsContent>

        <TabsContent value="privacy">
          <PrivacySettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

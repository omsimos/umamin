import { Metadata } from "next";
import { getSession, logout } from "@/lib/auth";
import { redirect } from "next/navigation";

import { SignOutButton } from "./components/sign-out-button";
import { SettingsTabs } from "./components/settings-tabs";

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

      <SettingsTabs />
    </div>
  );
}

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Link2OffIcon } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, logout } from "@/lib/auth";
import { SettingsTabs } from "./components/settings-tabs";
import { SignOutButton } from "./components/sign-out-button";

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

export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { session } = await getSession();
  const error = (await searchParams).error;

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

      <p className="text-sm text-muted-foreground mb-12">
        Manage your account settings
      </p>

      {error === "already_linked" && (
        <Alert variant="destructive" className="mb-4">
          <Link2OffIcon />
          <AlertTitle>Failed to link account</AlertTitle>
          <AlertDescription>
            Google account already connected to a different profile.
          </AlertDescription>
        </Alert>
      )}

      <SettingsTabs />
    </div>
  );
}

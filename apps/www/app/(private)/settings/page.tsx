import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth-guard";
import { SettingsContent } from "./components/settings-content";

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

export default function Settings() {
  return (
    <div className="w-full mx-auto max-w-lg container min-h-screen pb-24">
      <AuthGuard>
        <SettingsContent />
      </AuthGuard>
    </div>
  );
}

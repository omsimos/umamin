import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DashboardClient } from "./components/dashboard-client";

export const metadata: Metadata = { title: "Inbox" };

export default async function DashboardPage() {
  const { user } = await getSession();
  if (!user) redirect("/login");
  // Sends a default-password account to /settings. The data itself is guarded
  // in withAction and /api/messages, so this redirect is navigation only. It is
  // not in the (private) layout because that would loop on /settings.
  if (user.mustChangePassword) redirect("/settings");

  return <DashboardClient org={{ username: user.username }} />;
}

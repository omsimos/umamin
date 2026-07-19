import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { DashboardClient } from "./components/dashboard-client";

export const metadata: Metadata = { title: "Inbox" };

export default async function DashboardPage() {
  const { user } = await getSession();
  if (!user) redirect("/login");
  // First-run: force the org off the default invite password before anything
  // else. Lives here (not the (private) layout — that would redirect-loop on
  // /settings itself): dashboard is the only private page besides /settings,
  // and / redirects here. A NEW private page must repeat this gate.
  if (user.mustChangePassword) redirect("/settings");

  return <DashboardClient org={{ username: user.username }} />;
}

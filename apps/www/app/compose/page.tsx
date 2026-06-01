import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { toPublicUser } from "@/types/user";
import { ComposeView } from "./components/compose-view";

export const metadata: Metadata = {
  title: "Umamin — Compose",
  robots: { index: false, follow: false },
};

export default async function ComposePage() {
  const { user } = await getSession();

  if (!user) {
    redirect("/login");
  }

  return <ComposeView user={toPublicUser(user)} />;
}

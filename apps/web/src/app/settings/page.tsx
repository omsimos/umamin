import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

import { logout } from "@/actions";
import { SettingsForm } from "./components/form";
import { SignOutButton } from "./components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@umamin/ui/components/card";

export default async function Settings() {
  const { user } = await getSession();

  if (!user) {
    redirect("/login");
  }

  return (
    <Card className="w-full bg-bg border-none mx-auto max-w-lg container mt-36 min-h-screen">
      <CardHeader className="p-0">
        <div className="flex items-center justify-between">
          <CardTitle>Settings</CardTitle>
          <form action={logout}>
            <SignOutButton />
          </form>
        </div>

        <CardDescription>Manage your account settings.</CardDescription>
      </CardHeader>

      <CardContent className="p-0 mt-6">
        <SettingsForm user={user} />
      </CardContent>
    </Card>
  );
}

import { cache } from "react";
import { redirect } from "next/navigation";

import { logout } from "@/actions";
import { getClient } from "@/lib/gql";
import { getSession } from "@/lib/auth";
import { USER_BY_ID_QUERY } from "./queries";
import { SettingsForm } from "./components/form";
import { SignOutButton } from "./components/sign-out-button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@umamin/ui/components/card";
import { ProfileInfo } from "./components/profile-info";

const getUserById = cache(async (id: string) => {
  const res = await getClient().query(USER_BY_ID_QUERY, {
    id,
  });

  return res;
});

export default async function Settings() {
  const { user } = await getSession();

  if (!user) {
    redirect("/login");
  }

  const result = await getUserById(user.id);
  const profile = result.data?.userById?.profile?.length
    ? result.data?.userById?.profile[0]
    : null;

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
        {!!profile && <ProfileInfo {...profile} />}

        {result.data?.userById && <SettingsForm user={result.data.userById} />}
      </CardContent>
    </Card>
  );
}

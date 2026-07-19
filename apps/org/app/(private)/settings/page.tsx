import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@umamin/ui/components/card";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { PasswordForm } from "./components/password-form";
import { ProfileForm } from "./components/profile-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage your organization profile and password.
        </p>
      </div>

      {user.mustChangePassword && (
        <div className="border-primary/40 bg-primary/5 text-foreground rounded-lg border px-4 py-3 text-sm">
          <strong className="font-medium">Set a new password.</strong> You're
          using the default password from your invite — please change it below.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            displayName={user.displayName}
            question={user.question}
            acceptingMessages={user.acceptingMessages}
          />
        </CardContent>
      </Card>
    </div>
  );
}

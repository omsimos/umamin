import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./components/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const { session } = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-2xl font-semibold">
            Umamin for Organizations
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in to your organization account.
          </p>
        </div>
        <LoginForm />
        <p className="text-muted-foreground text-center text-xs">
          Accounts are invite-only. Contact your administrator for access.
        </p>
      </div>
    </main>
  );
}

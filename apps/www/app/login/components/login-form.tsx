"use client";

import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import posthog from "posthog-js";
import { useActionState, useRef } from "react";
import { login } from "@/lib/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, { error: "" });
  const usernameRef = useRef<HTMLInputElement>(null);

  const handleFormAction = async (formData: FormData) => {
    const username = formData.get("username") as string;

    // Call the server action
    formAction(formData);

    // Track login attempt - if there's an error it will be displayed
    // If no error and redirect happens, the user logged in successfully
    if (!state?.error && username) {
      posthog.identify(username.toLowerCase(), {
        username: username.toLowerCase(),
      });
      posthog.capture("user_logged_in", {
        username: username.toLowerCase(),
        login_method: "credentials",
      });
    }
  };

  // Track login errors
  if (state?.error && usernameRef.current?.value) {
    posthog.capture("user_login_failed", {
      error: state.error,
      username: usernameRef.current.value.toLowerCase(),
    });
  }

  return (
    <form action={handleFormAction} className="space-y-8">
      <div>
        <Label htmlFor="username">Username</Label>
        <Input
          required
          id="username"
          name="username"
          placeholder="umamin"
          className="mt-2"
          ref={usernameRef}
          onChange={(e) => {
            e.currentTarget.value = e.currentTarget.value.toLowerCase();
          }}
        />
      </div>

      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          required
          id="password"
          name="password"
          type="password"
          className="mt-2"
        />
        {state?.error && (
          <p className="text-red-500 text-sm mt-2 font-medium">{state.error}</p>
        )}
      </div>

      <div>
        <Button disabled={pending} type="submit" className="w-full">
          {pending && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
          Login
        </Button>

        <Button disabled={pending} variant="outline" asChild>
          <Link href="/auth/google" className="mt-4 w-full">
            Continue with Google
          </Link>
        </Button>
      </div>
    </form>
  );
}

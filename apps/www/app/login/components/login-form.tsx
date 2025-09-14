"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2Icon } from "lucide-react";

import { login } from "@/lib/auth";
import { Label } from "@umamin/ui/components/label";
import { Input } from "@umamin/ui/components/input";
import { Button } from "@umamin/ui/components/button";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, { error: "" });

  return (
    <form action={formAction} className="space-y-8">
      <div>
        <Label htmlFor="username">Username</Label>
        <Input
          required
          id="username"
          name="username"
          placeholder="umamin"
          className="mt-2"
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

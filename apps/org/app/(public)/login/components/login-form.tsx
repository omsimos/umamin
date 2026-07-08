"use client";

import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { Loader2Icon } from "lucide-react";
import { useActionState } from "react";
import { login } from "@/lib/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, { error: "" });

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          required
          id="username"
          name="username"
          placeholder="acme"
          autoComplete="username"
          onChange={(e) => {
            e.currentTarget.value = e.currentTarget.value.toLowerCase();
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          required
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
        />
        {state?.error && (
          <p className="text-destructive text-sm font-medium">{state.error}</p>
        )}
      </div>

      <Button disabled={pending} type="submit" className="w-full">
        {pending && <Loader2Icon className="animate-spin" />}
        Sign in
      </Button>
    </form>
  );
}

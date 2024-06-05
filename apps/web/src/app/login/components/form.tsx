"use client";

import { login } from "@/actions";
import { useFormState } from "react-dom";

import { LoginButton } from "./login-button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";

export function LoginForm() {
  const [state, formAction] = useFormState(login, { error: "" });

  return (
    <form action={formAction} className="space-y-6">
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
        {state.error && (
          <p className="text-red-500 text-sm mt-2 font-medium">{state.error}</p>
        )}
      </div>

      <LoginButton />
    </form>
  );
}

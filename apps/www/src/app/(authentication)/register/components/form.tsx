"use client";

import { signup } from "@/actions";
import { useFormState } from "react-dom";
import { RegisterButton } from "./button";
import { cn } from "@umamin/ui/lib/utils";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";

export function RegisterForm() {
  const [state, formAction] = useFormState(signup, { errors: {} });

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
        <p
          className={cn(
            "text-sm mt-2 text-muted-foreground",
            state.errors.username && "text-red-500",
          )}
        >
          {state.errors.username
            ? state.errors.username[0]
            : "You can still change this later"}
        </p>
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
        {state.errors.password && (
          <p className="text-sm mt-2 text-red-500">
            {state.errors.password[0]}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          required
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          className="mt-2"
        />
        {state.errors.confirmPassword && (
          <p className="text-sm mt-2 text-red-500">
            {state.errors.confirmPassword[0]}
          </p>
        )}
      </div>

      <RegisterButton />
    </form>
  );
}

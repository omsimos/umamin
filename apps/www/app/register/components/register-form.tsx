/* eslint-disable react/no-children-prop */
"use client";

import * as z from "zod";
import Link from "next/link";
import { toast } from "sonner";

import { useAppForm } from "@/hooks/form";
import { registerSchema } from "@/lib/schema";
import { Button } from "@umamin/ui/components/button";
import { signup } from "@/lib/auth";

export function RegisterForm() {
  const form = useAppForm({
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
    } as z.infer<typeof registerSchema>,
    validators: {
      onSubmit: registerSchema,
    },
    onSubmit: async ({ value }) => {
      const res = await signup(value);
      if (res?.error) {
        toast.error(res.error);
      }
    },
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <div>
        <form.AppField
          name="username"
          children={(field) => (
            <field.TextField isRequired label="Username" placeholder="umamin" />
          )}
        />

        <p className="text-muted-foreground text-sm mt-2">
          You can still change this later
        </p>
      </div>

      <form.AppField
        name="password"
        children={(field) => (
          <field.TextField type="password" isRequired label="Password" />
        )}
      />

      <form.AppField
        name="confirmPassword"
        children={(field) => (
          <field.TextField
            type="password"
            isRequired
            label="Confirm Password"
          />
        )}
      />

      <div className="space-y-4">
        <form.AppForm>
          <form.SubmitButton className="w-full" label="Create an account" />
        </form.AppForm>

        <Button variant="outline" asChild>
          <Link href="/auth/google" className="w-full">
            Continue with Google
          </Link>
        </Button>
      </div>
    </form>
  );
}

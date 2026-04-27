"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type * as z from "zod";
import { useAppForm } from "@/hooks/form";
import { apiClientErrorMessage } from "@/lib/api-client";
import { googleAuthUrl, signup } from "@/lib/api-mutations";
import { registerSchema } from "@/lib/schema";

export function RegisterForm() {
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: signup,
    onSuccess: () => {
      toast.success("Account created.");
      router.push("/inbox");
      router.refresh();
    },
    onError: (error) => {
      toast.error(apiClientErrorMessage(error, "Couldn't create account."));
    },
  });

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
      await mutation.mutateAsync(value);
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
            <field.TextField
              isRequired
              label="Username"
              placeholder="umamin"
              transform={(value) => value.toLowerCase()}
            />
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
          <Link prefetch={false} href={googleAuthUrl()} className="w-full">
            Continue with Google
          </Link>
        </Button>
      </div>
    </form>
  );
}

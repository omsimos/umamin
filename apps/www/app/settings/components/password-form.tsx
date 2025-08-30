/* eslint-disable react/no-children-prop */
"use client";

import * as z from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppForm } from "@/hooks/form";
import { passwordFormSchema } from "@/types/user";
import { updatePasswordAction } from "@/app/actions/user";

export function PasswordForm({
  passwordHash,
}: {
  passwordHash?: string | null;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof passwordFormSchema>) => {
      const res = await updatePasswordAction(values);

      if (res?.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: async () => {
      toast.success("Password updated");
      await queryClient.invalidateQueries({ queryKey: ["current_user"] });
    },
    onError: (err) => {
      console.error(err);
      toast.error(err.message);
    },
  });

  const form = useAppForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    validators: {
      onSubmit: passwordFormSchema,
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync(value);
    },
  });

  return (
    <form
      className="space-y-4 mt-8"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      {passwordHash && (
        <form.AppField
          name="currentPassword"
          children={(field) => (
            <field.TextField
              type="password"
              label="Current Password"
              placeholder="Enter current password"
              disabled={mutation.isPending}
            />
          )}
        />
      )}

      <form.AppField
        name="newPassword"
        children={(field) => (
          <field.TextField
            type="password"
            label="New Password"
            placeholder="Enter new password"
            disabled={mutation.isPending}
          />
        )}
      />

      <form.AppField
        name="confirmPassword"
        children={(field) => (
          <field.TextField
            type="password"
            label="Confirm New Password"
            placeholder="Re-enter new password"
            disabled={mutation.isPending}
          />
        )}
      />

      <div className="flex justify-end">
        <form.AppForm>
          <form.SubmitButton
            disabled={mutation.isPending}
            label={passwordHash ? "Update Password" : "Set Password"}
          />
        </form.AppForm>
      </div>
    </form>
  );
}

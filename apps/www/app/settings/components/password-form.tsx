"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyIcon } from "lucide-react";
import { toast } from "sonner";
import type * as z from "zod";
import { updatePasswordAction } from "@/app/actions/user";
import { useAppForm } from "@/hooks/form";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser } from "@/lib/query-cache";
import type { CurrentUserResponse } from "@/lib/query-types";
import { passwordFormSchema } from "@/types/user";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const queryClient = useQueryClient();
  const submitPasswordUpdate = useSingleFlightAction(updatePasswordAction);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof passwordFormSchema>) => {
      const res = await submitPasswordUpdate(values);

      if (res?.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: async () => {
      form.reset();
      toast.success("Password updated.");
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (currentUser) => ({
            ...currentUser,
            hasPassword: true,
          })),
      );
    },
    onError: (err) => {
      console.error(err);
      toast.error(err.message ?? "Couldn't update password.");
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
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      {hasPassword && (
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
            icon={KeyIcon}
            disabled={mutation.isPending}
            label={hasPassword ? "Update Password" : "Set Password"}
          />
        </form.AppForm>
      </div>
    </form>
  );
}

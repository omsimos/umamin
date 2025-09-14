/* eslint-disable react/no-children-prop */

import * as z from "zod";
import { toast } from "sonner";
import { InfoIcon, CheckIcon } from "lucide-react";
import { useAppForm } from "@/hooks/form";
import { generalSettingsSchema, UserWithAccount } from "@/types/user";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generalSettingsAction } from "@/app/actions/user";
import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer/async-rate-limiter";

export function GeneralSettings({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();

  const rateLimitedAction = useAsyncRateLimitedCallback(generalSettingsAction, {
    limit: 3,
    window: 60000, // 1 minute
    windowType: "sliding",
    onReject: () => {
      throw new Error("Limit reached. Please wait before trying again.");
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof generalSettingsSchema>) => {
      const res = await rateLimitedAction(values);
      if (res?.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      toast.success("Settings updated");
      queryClient.invalidateQueries({ queryKey: ["current_user"] });
    },
    onError: (error) => {
      console.error(error);
      toast.error(error.message);
    },
  });

  const form = useAppForm({
    defaultValues: {
      bio: user?.bio ?? "",
      question: user?.question ?? "",
      username: user?.username ?? "",
      displayName: user?.displayName ?? "",
    },
    validators: {
      onSubmit: generalSettingsSchema,
    },
    onSubmit: async ({ value }) => {
      if (
        value.username === user?.username &&
        value.bio === user.bio &&
        value.question === user.question &&
        value.displayName === user.displayName
      ) {
        toast.info("No changes made");
        return;
      }

      await mutation.mutateAsync(value);
    },
  });

  return (
    <form
      className="space-y-6 w-full"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <form.AppField
        name="displayName"
        children={(field) => (
          <field.TextField
            label="Display Name"
            placeholder="Umamin"
            disabled={mutation.isPending}
          />
        )}
      />

      <form.AppField
        name="username"
        children={(field) => (
          <div className="space-y-2">
            <field.TextField
              label="Username"
              placeholder="umamin"
              isRequired
              disabled={!user.account || mutation.isPending}
            />
            {user.account ? (
              <p className="text-sm text-muted-foreground">
                Your previous username will be available to other users.
              </p>
            ) : (
              <p className="text-sm text-yellow-600 flex items-center gap-1">
                <InfoIcon className="h-4 w-4" /> Google account required to
                change username
              </p>
            )}
          </div>
        )}
      />

      <form.AppField
        name="question"
        children={(field) => (
          <field.TextareaField
            label="Custom Message"
            placeholder="Send me an anonymous message!"
            className="min-h-[100px] resize-none"
            isRequired
            disabled={mutation.isPending}
          />
        )}
      />

      <form.AppField
        name="bio"
        children={(field) => (
          <field.TextareaField
            label="Bio"
            placeholder="Tell us a little bit about yourself"
            className="min-h-[100px] resize-none"
            disabled={mutation.isPending}
          />
        )}
      />

      <div className="flex justify-end">
        <form.AppForm>
          <form.SubmitButton icon={CheckIcon} label="Save Changes" />
        </form.AppForm>
      </div>
    </form>
  );
}

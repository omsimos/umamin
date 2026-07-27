import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { KeyIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser } from "@/lib/query-cache";
import { type CurrentUserResponse, passwordFormSchema } from "@/lib/types";
import { updatePasswordAction } from "./actions";

type Fields = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const EMPTY: Fields = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const queryClient = useQueryClient();
  const submitPasswordUpdate = useSingleFlightAction(updatePasswordAction);

  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>(
    {},
  );

  const set = (key: keyof Fields, value: string) =>
    setFields((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: async (values: Fields) => {
      const res = await submitPasswordUpdate(values);
      if ("error" in res) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      setFields(EMPTY);
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = passwordFormSchema.safeParse(fields);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof Fields, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof Fields;
        if (key && !nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data as Fields);
  };

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      {hasPassword && (
        <div className="space-y-1">
          <Label htmlFor="currentPassword">Current Password</Label>
          <Input
            id="currentPassword"
            type="password"
            placeholder="Enter current password"
            value={fields.currentPassword}
            disabled={mutation.isPending}
            onChange={(e) => set("currentPassword", e.target.value)}
          />
          {errors.currentPassword && (
            <p className="text-sm text-destructive">{errors.currentPassword}</p>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="newPassword">New Password</Label>
        <Input
          id="newPassword"
          type="password"
          placeholder="Enter new password"
          value={fields.newPassword}
          disabled={mutation.isPending}
          onChange={(e) => set("newPassword", e.target.value)}
        />
        {errors.newPassword && (
          <p className="text-sm text-destructive">{errors.newPassword}</p>
        )}
      </div>

      <div className="space-y-1">
        <Label htmlFor="confirmPassword">Confirm New Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          placeholder="Re-enter new password"
          value={fields.confirmPassword}
          disabled={mutation.isPending}
          onChange={(e) => set("confirmPassword", e.target.value)}
        />
        {errors.confirmPassword && (
          <p className="text-sm text-destructive">{errors.confirmPassword}</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <KeyIcon className="size-4" />
          )}
          {hasPassword ? "Update Password" : "Set Password"}
        </Button>
      </div>
    </form>
  );
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { Textarea } from "@umamin/ui/components/textarea";
import { CheckIcon, InfoIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser, patchUserProfile } from "@/lib/query-cache";
import {
  type CurrentUserResponse,
  generalSettingsSchema,
  type UserProfileResponse,
  type UserWithAccount,
} from "@/lib/types";
import { generalSettingsAction } from "./actions";
import { ProfileMedia } from "./profile-media";
import { ProfileSong } from "./profile-song";

type Fields = {
  bio: string;
  question: string;
  username: string;
  displayName: string;
};

// apps/www used @tanstack/react-form (`useAppForm`), not a dependency here — a
// plain controlled form with a `zod` safeParse gate replaces it (same schema,
// same submit → mutation → cache-patch flow).
export function GeneralSettings({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();
  const submitSettings = useSingleFlightAction(generalSettingsAction);

  const [fields, setFields] = useState<Fields>({
    bio: user?.bio ?? "",
    question: user?.question ?? "",
    username: user?.username ?? "",
    displayName: user?.displayName ?? "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>(
    {},
  );

  const set = (key: keyof Fields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value.replace(/\s+/g, " ") }));
  };

  const mutation = useMutation({
    mutationFn: async (values: Fields) => {
      const res = await submitSettings(values);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res;
    },
    onSuccess: (result, values) => {
      const nextUsername = result?.user?.username ?? values.username;
      const nextProfile = { ...user, ...result?.user };

      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (currentUser) => ({
            ...currentUser,
            ...result?.user,
          })),
      );

      queryClient.removeQueries({
        queryKey: queryKeys.userProfile(user.username),
        exact: true,
      });
      queryClient.removeQueries({
        queryKey: queryKeys.userProfileViewer(user.username),
        exact: true,
      });

      queryClient.setQueryData<UserProfileResponse>(
        queryKeys.userProfile(nextUsername),
        (current) =>
          patchUserProfile(current, () => nextProfile) ?? nextProfile,
      );

      queryClient.removeQueries({
        queryKey: queryKeys.userProfileViewer(nextUsername),
        exact: true,
      });

      toast.success("Settings updated.");
    },
    onError: (error) => {
      console.error(error);
      toast.error(error.message ?? "Couldn't update settings.");
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = generalSettingsSchema.safeParse({
      ...fields,
      username: fields.username.toLowerCase(),
    });

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

    if (
      parsed.data.username === user?.username &&
      parsed.data.bio === user.bio &&
      parsed.data.question === user.question &&
      parsed.data.displayName === user.displayName
    ) {
      toast.info("No changes to save.");
      return;
    }

    mutation.mutate(parsed.data as Fields);
  };

  return (
    <div className="space-y-8 w-full">
      <ProfileMedia user={user} />
      <ProfileSong user={user} />

      <form className="space-y-6 w-full" onSubmit={onSubmit}>
        <div className="space-y-1">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            placeholder="Umamin"
            value={fields.displayName}
            disabled={mutation.isPending}
            maxLength={20}
            onChange={(e) => set("displayName", e.target.value)}
          />
          {errors.displayName && (
            <p className="text-sm text-destructive">{errors.displayName}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <Label htmlFor="username">
              Username<span className="text-destructive">*</span>
            </Label>
            <Input
              id="username"
              placeholder="umamin"
              value={fields.username}
              disabled={!user.account || mutation.isPending}
              maxLength={20}
              onChange={(e) => set("username", e.target.value.toLowerCase())}
            />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username}</p>
            )}
          </div>
          {user.account ? (
            <p className="text-sm text-muted-foreground">
              Your previous username will be available to other users.
            </p>
          ) : (
            <p className="text-sm text-yellow-600 flex items-center gap-1">
              <InfoIcon className="h-4 w-4" /> Google account required to change
              username
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="question">
            Custom Message<span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="question"
            placeholder="Send me an anonymous message!"
            className="min-h-[100px] resize-none"
            value={fields.question}
            disabled={mutation.isPending}
            maxLength={150}
            onChange={(e) => set("question", e.target.value)}
          />
          {fields.question.length >= 120 && (
            <p className="text-right text-muted-foreground text-xs tabular-nums">
              {150 - fields.question.length} left
            </p>
          )}
          {errors.question && (
            <p className="text-sm text-destructive">{errors.question}</p>
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            placeholder="Tell us a little bit about yourself"
            className="min-h-[100px] resize-none"
            value={fields.bio}
            disabled={mutation.isPending}
            maxLength={150}
            onChange={(e) => set("bio", e.target.value)}
          />
          {fields.bio.length >= 120 && (
            <p className="text-right text-muted-foreground text-xs tabular-nums">
              {150 - fields.bio.length} left
            </p>
          )}
          {errors.bio && (
            <p className="text-sm text-destructive">{errors.bio}</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <CheckIcon className="size-4" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}

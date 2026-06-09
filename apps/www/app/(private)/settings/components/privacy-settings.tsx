"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import { CircleUserRoundIcon, MessageCircleOffIcon } from "lucide-react";
import { toast } from "sonner";
import {
  toggleDisplayPictureAction,
  toggleQuietModeAction,
} from "@/app/actions/user";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser, patchUserProfile } from "@/lib/query-cache";
import type {
  CurrentUserResponse,
  UserProfileResponse,
} from "@/lib/query-types";
import type { UserWithAccount } from "@/types/user";
import { BlockedUsersSection } from "./blocked-users-section";
import { BlockedWordsSection } from "./blocked-words-section";

export function PrivacySettings({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();

  const patchOwnProfile = (updates: Partial<UserWithAccount>) => {
    queryClient.setQueryData<UserProfileResponse>(
      queryKeys.userProfile(user.username),
      (current) =>
        patchUserProfile(current, (currentUser) => ({
          ...currentUser,
          ...updates,
        })),
    );
  };

  const toggleDisplayPicture = useSingleFlightAction(
    toggleDisplayPictureAction,
  );
  const toggleQuietMode = useSingleFlightAction(toggleQuietModeAction);

  const displayPictureMutation = useMutation({
    mutationFn: async () => {
      if (!user.imageUrl) {
        throw new Error("Upload a photo or connect a Google account");
      }

      const res = await toggleDisplayPicture(user.account?.picture);
      if ("error" in res && res.error) {
        throw new Error(res.error);
      }

      return "imageUrl" in res && !!res.imageUrl;
    },
    onSuccess: (data) => {
      const imageUrl = data ? (user.account?.picture ?? user.imageUrl) : null;

      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (currentUser) => ({
            ...currentUser,
            imageUrl,
          })),
      );
      patchOwnProfile({ imageUrl });
      toast.success(
        data ? "Profile photo displayed." : "Profile photo removed.",
      );
    },
    onError: (err) => {
      console.error(err);
      toast.error(err.message ?? "Couldn't update photo.");
    },
  });

  const quietModeMutation = useMutation({
    mutationFn: async () => {
      const res = await toggleQuietMode();
      if ("error" in res && res.error) {
        throw new Error(res.error);
      }

      return "quietMode" in res ? res.quietMode : undefined;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (currentUser) => ({
            ...currentUser,
            quietMode: data ?? currentUser.quietMode,
          })),
      );
      patchOwnProfile({ quietMode: data ?? user.quietMode });
      toast.success(data ? "Quiet mode enabled." : "Quiet mode disabled.");
    },
    onError: (err) => {
      console.error(err);
      toast.error(err.message ?? "Couldn't update quiet mode.");
    },
  });

  return (
    <div className="space-y-8">
      <section>
        <Label>Update Preferences</Label>
        <div className="flex items-center space-x-4 rounded-md border p-4 mt-2">
          <CircleUserRoundIcon className="size-6" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium leading-none">Display Picture</p>
            {user.imageUrl ? (
              <p className="text-sm text-muted-foreground">
                Turning this off permanently deletes an uploaded photo
              </p>
            ) : (
              <p className="text-sm text-yellow-600">
                Upload a photo or connect a Google account
              </p>
            )}
          </div>
          <Switch
            disabled={displayPictureMutation.isPending || !user.imageUrl}
            checked={!!user?.imageUrl}
            onCheckedChange={() => displayPictureMutation.mutate()}
          />
        </div>

        <div className="flex items-center space-x-4 rounded-md border p-4 mt-4">
          <MessageCircleOffIcon className="size-6" />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium leading-none">Quiet Mode</p>
            <p className="text-sm text-muted-foreground">
              Temporarily disable incoming messages
            </p>
          </div>
          <Switch
            disabled={quietModeMutation.isPending}
            checked={user?.quietMode}
            onCheckedChange={() => quietModeMutation.mutate()}
          />
        </div>
      </section>

      <BlockedWordsSection user={user} />

      <BlockedUsersSection />
    </div>
  );
}

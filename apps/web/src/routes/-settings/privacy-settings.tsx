import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import { MessageCircleOffIcon } from "lucide-react";
import { toast } from "sonner";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser, patchUserProfile } from "@/lib/query-cache";
import type {
  CurrentUserResponse,
  UserProfileResponse,
  UserWithAccount,
} from "@/lib/types";
import { toggleQuietModeAction } from "./actions";
import { BlockedUsersSection } from "./blocked-users-section";
import { BlockedWordsSection } from "./blocked-words-section";
import { PushNotificationToggle } from "./push-notification-toggle";

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

  const toggleQuietMode = useSingleFlightAction(toggleQuietModeAction);

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

        <PushNotificationToggle />
      </section>

      <BlockedWordsSection user={user} />

      <BlockedUsersSection />
    </div>
  );
}

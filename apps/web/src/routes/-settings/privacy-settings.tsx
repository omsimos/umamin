import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import { MessageCircleOffIcon, MessageSquareOffIcon } from "lucide-react";
import { toast } from "sonner";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { ExpectedError } from "@/lib/expected-error";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser, patchUserProfile } from "@/lib/query-cache";
import type {
  CurrentUserResponse,
  UserProfileResponse,
  UserWithAccount,
} from "@/lib/types";
import { toggleHideDramaAction, toggleQuietModeAction } from "./actions";
import { BlockedUsersSection } from "./blocked-users-section";
import { BlockedWordsSection } from "./blocked-words-section";
import { MutedUsersSection } from "./muted-users-section";
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
        throw new ExpectedError(res.error);
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

  const { contentModeration } = useFeatureFlags();
  const toggleHideDrama = useSingleFlightAction(toggleHideDramaAction);

  const hideDramaMutation = useMutation({
    mutationFn: async () => {
      const res = await toggleHideDrama();
      if ("error" in res && res.error) {
        throw new ExpectedError(res.error);
      }

      return "hideDrama" in res ? res.hideDrama : undefined;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (currentUser) => ({
            ...currentUser,
            hideDrama: data ?? currentUser.hideDrama,
          })),
      );
      toast.success(
        data ? "Disputes will be folded." : "Disputes will show in full.",
      );
    },
    onError: (err) => {
      console.error(err);
      toast.error(err.message ?? "Couldn't update this setting.");
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

        {contentModeration && (
          <div className="flex items-center space-x-4 rounded-md border p-4 mt-2">
            <MessageSquareOffIcon className="size-6" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">Hide disputes</p>
              <p className="text-sm text-muted-foreground">
                Fold posts and notes that look like callouts, indirects or
                public fights. Tap one to read it.
              </p>
            </div>
            <Switch
              disabled={hideDramaMutation.isPending}
              checked={user?.hideDrama ?? true}
              onCheckedChange={() => hideDramaMutation.mutate()}
            />
          </div>
        )}

        <PushNotificationToggle />
      </section>

      <BlockedWordsSection user={user} />

      <MutedUsersSection />

      <BlockedUsersSection />
    </div>
  );
}

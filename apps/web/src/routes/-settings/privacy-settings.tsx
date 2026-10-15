import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import {
  MessageCircleOffIcon,
  MessageSquareOffIcon,
  ShieldIcon,
} from "lucide-react";
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
import {
  toggleHideDramaAction,
  toggleMessageFilterAction,
  toggleQuietModeAction,
} from "./actions";
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

  const toggleMessageFilter = useSingleFlightAction(toggleMessageFilterAction);

  const messageFilterMutation = useMutation({
    mutationFn: async () => {
      const res = await toggleMessageFilter();
      if ("error" in res && res.error) {
        throw new ExpectedError(res.error);
      }

      return "messageFilter" in res ? res.messageFilter : undefined;
    },
    onSuccess: (data) => {
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (currentUser) => ({
            ...currentUser,
            messageFilter: data ?? currentUser.messageFilter,
          })),
      );
      // The inbox labels follow the setting, so refetch what's on screen.
      queryClient.invalidateQueries({ queryKey: queryKeys.receivedMessages() });
      toast.success(
        data ? "Message filter turned on." : "Message filter turned off.",
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
            aria-label="Quiet Mode"
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
                Uma folds posts that look like callouts, indirects, gossip or
                fights. Turn this off to see them in full.
              </p>
            </div>
            <Switch
              aria-label="Hide disputes"
              disabled={hideDramaMutation.isPending}
              checked={user?.hideDrama ?? true}
              onCheckedChange={() => hideDramaMutation.mutate()}
            />
          </div>
        )}

        {contentModeration && (
          <div className="flex items-center space-x-4 rounded-md border p-4 mt-2">
            <ShieldIcon className="size-6" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">
                Filter hurtful messages
              </p>
              <p className="text-sm text-muted-foreground">
                Uma checks new anonymous messages and covers the ones that look
                hurtful or like scams. They still arrive, and you can open any
                of them.
              </p>
            </div>
            <Switch
              aria-label="Filter hurtful messages"
              disabled={messageFilterMutation.isPending}
              checked={user?.messageFilter ?? false}
              onCheckedChange={() => messageFilterMutation.mutate()}
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

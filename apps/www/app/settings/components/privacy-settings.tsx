"use client";

import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CircleUserRoundIcon, MessageCircleOffIcon } from "lucide-react";
import {
  toggleDisplayPictureAction,
  toggleQuietModeAction,
} from "@/app/actions/user";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import { UserWithAccount } from "@/types/user";
import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer/async-rate-limiter";

export function PrivacySettings({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();

  const rateLimitedToggleDisplay = useAsyncRateLimitedCallback(
    toggleDisplayPictureAction,
    {
      limit: 3,
      window: 60000, // 1 minute
      windowType: "sliding",
      onReject: () => {
        throw new Error("Limit reached. Please wait before trying again.");
      },
    },
  );

  const displayPictureMutation = useMutation({
    mutationFn: async () => {
      if (!user.account) {
        throw new Error("Google account not connected");
      }

      const res = await rateLimitedToggleDisplay(user.account.picture);
      if (res.error) {
        throw new Error(res.error);
      }

      return !!res.imageUrl;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["current_user"] });
      toast.success(
        data ? "Picture is now displaying" : "Picture is no longer displaying",
      );
    },
    onError: (err) => {
      console.error(err);
      toast.error(err.message);
    },
  });

  const rateLimitedToggleQuiet = useAsyncRateLimitedCallback(
    toggleQuietModeAction,
    {
      limit: 3,
      window: 60000, // 1 minute
      windowType: "sliding",
      onReject: () => {
        throw new Error("Limit reached. Please wait before trying again.");
      },
    },
  );

  const quietModeMutation = useMutation({
    mutationFn: async () => {
      const res = await rateLimitedToggleQuiet();
      if (res.error) {
        throw new Error(res.error);
      }

      return res.quietMode;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["current_user"] });
      toast.success(data ? "Quiet mode enabled" : "Quiet mode disabled");
    },
    onError: (err) => {
      console.error(err);
      toast.error(err.message);
    },
  });

  return (
    <section>
      <Label>Update Preferences</Label>
      <div className="flex items-center space-x-4 rounded-md border p-4 mt-2">
        <CircleUserRoundIcon className="size-6" />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium leading-none">Display Picture</p>
          {user.account ? (
            <p className="text-sm text-muted-foreground">
              Show picture from connected account
            </p>
          ) : (
            <p className="text-sm text-yellow-600">Google account required</p>
          )}
        </div>
        <Switch
          disabled={displayPictureMutation.isPending || !user.account}
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
  );
}

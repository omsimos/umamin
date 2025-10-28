"use client";

import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer/async-rate-limiter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import {
  CircleUserRoundIcon,
  Loader2Icon,
  MessageCircleOffIcon,
  ScanFaceIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  previewGravatarAvatarAction,
  toggleDisplayPictureAction,
  toggleQuietModeAction,
  updateAvatarAction,
} from "@/app/actions/user";
import type { UserWithAccount } from "@/types/user";

export function PrivacySettings({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();
  const [gravatarEmail, setGravatarEmail] = useState("");
  const [gravatarPreview, setGravatarPreview] = useState<string | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (email: string) => previewGravatarAvatarAction(email),
    onSuccess: (res) => {
      if (!res || "error" in res) {
        toast.error(res?.error ?? "Unable to find a Gravatar for that email.");
        setGravatarPreview(null);
        return;
      }

      setGravatarPreview(res.url);
      toast.success("Gravatar preview updated");
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to preview Gravatar");
    },
  });

  const applyGravatarMutation = useMutation({
    mutationFn: async (email: string) =>
      updateAvatarAction({ source: "gravatar", email }),
    onSuccess: (res) => {
      if (!res || "error" in res) {
        toast.error(res?.error ?? "Failed to update profile photo.");
        return;
      }

      if ("imageUrl" in res) {
        toast.success("Profile photo updated");
        setGravatarPreview(res.imageUrl ?? null);
        queryClient.invalidateQueries({ queryKey: ["current_user"] });
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to update profile photo");
    },
  });

  const useGooglePhotoMutation = useMutation({
    mutationFn: async () => updateAvatarAction({ source: "google" }),
    onSuccess: (res) => {
      if (!res || "error" in res) {
        toast.error(res?.error ?? "Unable to use Google photo.");
        return;
      }

      toast.success("Google profile photo restored");

      if ("imageUrl" in res) {
        setGravatarPreview(res.imageUrl ?? null);
        queryClient.invalidateQueries({ queryKey: ["current_user"] });
      }
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to switch back to Google photo");
    },
  });

  const isPreviewing = previewMutation.isPending;
  const isUpdatingGravatar = applyGravatarMutation.isPending;
  const isUsingGoogle = useGooglePhotoMutation.isPending;
  const previewSrc =
    gravatarPreview ?? user.imageUrl ?? user.account?.picture ?? "";

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
    <div className="space-y-8">
      <section>
        <Label htmlFor="gravatar-email">Profile Photo</Label>
        <div className="space-y-4 bg-secondary p-4 rounded-lg border mt-2">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                className="rounded-full"
                src={previewSrc}
                alt="Profile avatar preview"
              />
              <AvatarFallback className="md:text-4xl text-xl">
                <ScanFaceIcon />
              </AvatarFallback>
            </Avatar>

            <div className="text-sm text-muted-foreground">
              {gravatarPreview
                ? "Previewing new Gravatar"
                : "Current profile photo"}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gravatar-email">Gravatar Email</Label>
            <Input
              id="gravatar-email"
              type="email"
              placeholder="name@example.com"
              value={gravatarEmail}
              onChange={(event) => setGravatarEmail(event.target.value)}
              autoComplete="email"
            />
            <p className="text-xs text-muted-foreground">
              Enter the email linked to your Gravatar account to preview and use
              that avatar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!gravatarEmail || isPreviewing}
              onClick={() => previewMutation.mutate(gravatarEmail)}
            >
              {isPreviewing && <Loader2Icon className="h-4 w-4 animate-spin" />}
              Preview
            </Button>

            <Button
              type="button"
              disabled={!gravatarEmail || isUpdatingGravatar}
              onClick={() => applyGravatarMutation.mutate(gravatarEmail)}
            >
              {isUpdatingGravatar && (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              )}
              Use Gravatar
            </Button>

            {user.account?.picture && (
              <Button
                type="button"
                variant="outline"
                disabled={isUsingGoogle}
                onClick={() => useGooglePhotoMutation.mutate()}
              >
                {isUsingGoogle && (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                )}
                Use Google Photo
              </Button>
            )}
          </div>
        </div>
      </section>

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
    </div>
  );
}

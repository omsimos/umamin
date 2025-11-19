"use client";

import { useAsyncRateLimitedCallback } from "@tanstack/react-pacer/async-rate-limiter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@umamin/ui/components/dialog";
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
  getGravatarAction,
  toggleDisplayPictureAction,
  toggleQuietModeAction,
  updateAvatarAction,
} from "@/app/actions/user";
import type { UserWithAccount } from "@/types/user";

export function PrivacySettings({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();
  const [gravatarEmail, setGravatarEmail] = useState("");
  const [avatarPreviewUrl, setAvatarPreview] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const googlePicture = user.account?.picture;

  const gravatarMutation = useMutation({
    mutationFn: async (email: string) => getGravatarAction(email),
    onSuccess: (res) => {
      if (!res || "error" in res) {
        toast.error(res?.error ?? "Unable to find a Gravatar for that email.");
        setAvatarPreview(null);
        return;
      }

      setAvatarPreview(res.url);
      setPreviewOpen(true);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to preview Gravatar");
    },
  });

  const isPreviewing = gravatarMutation.isPending;

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
      if (!user.imageUrl) {
        throw new Error("Gravatar or Google account not connected");
      }

      const res = await rateLimitedToggleDisplay(user.account?.picture);
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

  const updateAvatarMutation = useMutation({
    mutationFn: async (url: string) => {
      const res = await updateAvatarAction(url);
      if (res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["current_user"] });
      toast.success("Profile photo updated");
      setAvatarPreview(null);
      setPreviewOpen(false);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

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
        <div className="space-y-4 p-4 rounded-lg border mt-2">
          <div className="flex gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                className="rounded-full"
                src={user.imageUrl ?? ""}
                alt="Profile avatar preview"
              />
              <AvatarFallback className="md:text-4xl text-xl">
                <ScanFaceIcon />
              </AvatarFallback>
            </Avatar>

            <div className="space-y-2 w-full">
              <Label htmlFor="gravatar-email">Gravatar Email</Label>
              <Input
                id="gravatar-email"
                type="email"
                placeholder="name@example.com"
                className="w-full"
                value={gravatarEmail}
                onChange={(event) => setGravatarEmail(event.target.value)}
                autoComplete="email"
              />
              <p className="text-xs text-muted-foreground">
                Enter the email linked to your Gravatar account.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              disabled={!gravatarEmail || isPreviewing}
              onClick={() => gravatarMutation.mutate(gravatarEmail)}
            >
              {isPreviewing && <Loader2Icon className="h-4 w-4 animate-spin" />}
              Use Gravatar
            </Button>

            {googlePicture && (
              <Button
                onClick={() => {
                  setAvatarPreview(googlePicture);
                  setPreviewOpen(true);
                }}
                type="button"
                variant="outline"
              >
                {/* <Loader2Icon className="h-4 w-4 animate-spin" /> */}
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
            {user.imageUrl ? (
              <p className="text-sm text-muted-foreground">
                Show picture from connected account
              </p>
            ) : (
              <p className="text-sm text-yellow-600">
                Gravatar or Google account required
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader className="sr-only">
            <DialogTitle>Preview Avatar</DialogTitle>
          </DialogHeader>

          {avatarPreviewUrl && (
            <>
              <Avatar className="w-full h-auto mx-auto mb-4 max-w-[300px]">
                <AvatarImage
                  className="rounded-full"
                  src={avatarPreviewUrl}
                  alt="Profile avatar preview"
                />
                <AvatarFallback className="md:text-4xl text-xl">
                  <ScanFaceIcon />
                </AvatarFallback>
              </Avatar>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  disabled={updateAvatarMutation.isPending}
                  onClick={() => updateAvatarMutation.mutate(avatarPreviewUrl)}
                  type="submit"
                >
                  Apply photo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

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
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import {
  CircleUserRoundIcon,
  ImagePlusIcon,
  Loader2Icon,
  MessageCircleOffIcon,
  ScanFaceIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { presignAvatarUploadAction } from "@/app/actions/upload";
import {
  toggleDisplayPictureAction,
  toggleQuietModeAction,
  updateAvatarAction,
  updateProfilePhotoAction,
} from "@/app/actions/user";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import { compressAvatar, ImageCompressError } from "@/lib/image-compress";
import {
  MAX_AVATAR_SOURCE_BYTES,
  postImagesEnabled,
  type UploadContentType,
} from "@/lib/post-images";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser, patchUserProfile } from "@/lib/query-cache";
import type {
  CurrentUserResponse,
  UserProfileResponse,
} from "@/lib/query-types";
import type { UserWithAccount } from "@/types/user";
import { BlockedUsersSection } from "./blocked-users-section";
import { BlockedWordsSection } from "./blocked-words-section";

type PendingPhoto =
  | {
      kind: "upload";
      blob: Blob;
      contentType: UploadContentType;
      previewUrl: string;
    }
  | { kind: "google"; previewUrl: string };

export function PrivacySettings({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingPhoto | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isCompressing, setCompressing] = useState(false);

  const googlePicture = user.account?.picture;
  const uploadsAvailable = postImagesEnabled();

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
  const applyGooglePhoto = useSingleFlightAction(updateAvatarAction);
  const applyUploadedPhoto = useSingleFlightAction(updateProfilePhotoAction);

  const clearPending = () => {
    setPending((current) => {
      if (current?.kind === "upload") {
        URL.revokeObjectURL(current.previewUrl);
      }
      return null;
    });
  };

  const handlePickPhoto = async (file: File) => {
    // Release any previous pick's blob URL before it's overwritten.
    clearPending();
    setCompressing(true);
    try {
      const compressed = await compressAvatar(file);
      setPending({
        kind: "upload",
        blob: compressed.blob,
        contentType: compressed.contentType,
        previewUrl: URL.createObjectURL(compressed.blob),
      });
      setPreviewOpen(true);
    } catch (err) {
      toast.error(
        err instanceof ImageCompressError
          ? err.message
          : "Couldn't process this image.",
      );
    } finally {
      setCompressing(false);
    }
  };

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

  const updateAvatarMutation = useMutation({
    mutationFn: async (photo: PendingPhoto) => {
      if (photo.kind === "google") {
        const res = await applyGooglePhoto(photo.previewUrl);
        if ("error" in res && res.error) {
          throw new Error(res.error);
        }
        return "imageUrl" in res ? res.imageUrl : undefined;
      }

      const presign = await presignAvatarUploadAction({
        contentType: photo.contentType,
        contentLength: photo.blob.size,
      });
      if (!("key" in presign) || !presign.key || !presign.url) {
        throw new Error(
          ("error" in presign ? presign.error : undefined) ??
            "Upload failed. Please try again.",
        );
      }

      const put = await fetch(presign.url, {
        method: "PUT",
        // Must match the presigned signature exactly or R2 rejects with 403.
        headers: { "Content-Type": photo.contentType },
        body: photo.blob,
      });
      if (!put.ok) {
        throw new Error("Upload failed. Please try again.");
      }

      const res = await applyUploadedPhoto({ key: presign.key });
      if ("error" in res && res.error) {
        throw new Error(res.error);
      }
      return "imageUrl" in res ? res.imageUrl : undefined;
    },
    onSuccess: (imageUrl) => {
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (currentUser) => ({
            ...currentUser,
            imageUrl: imageUrl ?? currentUser.imageUrl,
          })),
      );
      patchOwnProfile({ imageUrl: imageUrl ?? user.imageUrl });
      toast.success("Profile photo updated.");
      setPreviewOpen(false);
      clearPending();
    },
    onError: (err) => {
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
        <Label>Profile Photo</Label>
        <div className="space-y-4 p-4 rounded-lg border mt-2">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage
                className="rounded-full"
                src={user.imageUrl ?? ""}
                alt="Current profile photo"
              />
              <AvatarFallback className="md:text-4xl text-xl">
                <ScanFaceIcon />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">Upload a photo</p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, or WebP, up to{" "}
                {MAX_AVATAR_SOURCE_BYTES / (1024 * 1024)}MB.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePickPhoto(file);
                e.target.value = "";
              }}
            />

            {uploadsAvailable && (
              <Button
                type="button"
                disabled={isCompressing}
                onClick={() => fileInputRef.current?.click()}
              >
                {isCompressing ? (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlusIcon className="h-4 w-4" />
                )}
                Upload photo
              </Button>
            )}

            {googlePicture && (
              <Button
                onClick={() => {
                  clearPending();
                  setPending({ kind: "google", previewUrl: googlePicture });
                  setPreviewOpen(true);
                }}
                type="button"
                variant="outline"
              >
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

      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open && !updateAvatarMutation.isPending) {
            clearPending();
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="sr-only">Preview profile photo</DialogTitle>
          </DialogHeader>

          {pending && (
            <>
              <Avatar className="w-full h-auto mx-auto mb-4 max-w-[300px]">
                <AvatarImage
                  className="rounded-full"
                  src={pending.previewUrl}
                  alt="Profile photo preview"
                />
                <AvatarFallback className="md:text-4xl text-xl">
                  <ScanFaceIcon />
                </AvatarFallback>
              </Avatar>

              <DialogFooter>
                <DialogClose asChild>
                  {/* The PUT + claim can't be aborted mid-flight; letting the
                      dialog close would surface a surprise success later. */}
                  <Button
                    variant="outline"
                    disabled={updateAvatarMutation.isPending}
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  disabled={updateAvatarMutation.isPending}
                  onClick={() => updateAvatarMutation.mutate(pending)}
                  type="submit"
                >
                  {updateAvatarMutation.isPending && (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  )}
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

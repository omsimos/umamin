"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Label } from "@umamin/ui/components/label";
import {
  ImageIcon,
  ImagePlusIcon,
  Loader2Icon,
  ScanFaceIcon,
  Trash2Icon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  presignAvatarUploadAction,
  presignBannerUploadAction,
} from "@/app/actions/upload";
import {
  removeProfileBannerAction,
  updateAvatarAction,
  updateProfileBannerAction,
  updateProfilePhotoAction,
} from "@/app/actions/user";
import { ImageCropDialog } from "@/components/image-crop-dialog";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import {
  compressAvatar,
  compressBanner,
  ImageCompressError,
} from "@/lib/image-compress";
import type { CropArea } from "@/lib/image-crop";
import {
  BANNER_ASPECT,
  MAX_AVATAR_SOURCE_BYTES,
  MAX_BANNER_SOURCE_BYTES,
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

type CropTarget = { kind: "banner" | "avatar"; file: File };

async function uploadToR2(url: string, blob: Blob, contentType: string) {
  const put = await fetch(url, {
    method: "PUT",
    // Must match the presigned signature exactly or R2 rejects with 403.
    headers: { "Content-Type": contentType },
    body: blob,
  });
  if (!put.ok) {
    throw new Error("Upload failed. Please try again.");
  }
}

export function ProfileMedia({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickKind = useRef<CropTarget["kind"]>("avatar");
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);

  const googlePicture = user.account?.picture;
  const uploadsAvailable = postImagesEnabled();

  const applyBanner = useSingleFlightAction(updateProfileBannerAction);
  const applyAvatar = useSingleFlightAction(updateProfilePhotoAction);
  const removeBanner = useSingleFlightAction(removeProfileBannerAction);
  const applyGooglePhoto = useSingleFlightAction(updateAvatarAction);

  const patchImage = (updates: {
    imageUrl?: string | null;
    bannerImageUrl?: string | null;
  }) => {
    queryClient.setQueryData<CurrentUserResponse>(
      queryKeys.currentUser(),
      (current) =>
        patchCurrentUser(current, (currentUser) => ({
          ...currentUser,
          ...updates,
        })),
    );
    queryClient.setQueryData<UserProfileResponse>(
      queryKeys.userProfile(user.username),
      (current) =>
        patchUserProfile(current, (currentUser) => ({
          ...currentUser,
          ...updates,
        })),
    );
  };

  const closeCrop = () => setCropTarget(null);

  const pickFile = (kind: CropTarget["kind"]) => {
    pickKind.current = kind;
    fileInputRef.current?.click();
  };

  const presignAndUpload = async (
    blob: Blob,
    contentType: UploadContentType,
    presign:
      | typeof presignBannerUploadAction
      | typeof presignAvatarUploadAction,
  ) => {
    const res = await presign({ contentType, contentLength: blob.size });
    if (!("key" in res) || !res.key || !res.url) {
      throw new Error(
        ("error" in res ? res.error : undefined) ??
          "Upload failed. Please try again.",
      );
    }
    await uploadToR2(res.url, blob, contentType);
    return res.key;
  };

  const bannerMutation = useMutation({
    mutationFn: async ({ file, crop }: { file: File; crop: CropArea }) => {
      const compressed = await compressBanner(file, crop);
      const key = await presignAndUpload(
        compressed.blob,
        compressed.contentType,
        presignBannerUploadAction,
      );
      const res = await applyBanner({ key });
      if ("error" in res && res.error) {
        throw new Error(res.error);
      }
      return "bannerImageUrl" in res ? res.bannerImageUrl : undefined;
    },
    onSuccess: (bannerImageUrl) => {
      patchImage({ bannerImageUrl: bannerImageUrl ?? user.bannerImageUrl });
      toast.success("Banner updated.");
      closeCrop();
    },
    onError: (err) => {
      toast.error(
        err instanceof ImageCompressError || err instanceof Error
          ? err.message
          : "Couldn't update banner.",
      );
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async ({ file, crop }: { file: File; crop: CropArea }) => {
      const compressed = await compressAvatar(file, crop);
      const key = await presignAndUpload(
        compressed.blob,
        compressed.contentType,
        presignAvatarUploadAction,
      );
      const res = await applyAvatar({ key });
      if ("error" in res && res.error) {
        throw new Error(res.error);
      }
      return "imageUrl" in res ? res.imageUrl : undefined;
    },
    onSuccess: (imageUrl) => {
      patchImage({ imageUrl: imageUrl ?? user.imageUrl });
      toast.success("Profile photo updated.");
      closeCrop();
    },
    onError: (err) => {
      toast.error(
        err instanceof ImageCompressError || err instanceof Error
          ? err.message
          : "Couldn't update photo.",
      );
    },
  });

  const removeBannerMutation = useMutation({
    mutationFn: async () => {
      const res = await removeBanner();
      if ("error" in res && res.error) {
        throw new Error(res.error);
      }
    },
    onSuccess: () => {
      patchImage({ bannerImageUrl: null });
      toast.success("Banner removed.");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Couldn't remove banner.",
      );
    },
  });

  const googlePhotoMutation = useMutation({
    mutationFn: async () => {
      if (!googlePicture) return undefined;
      const res = await applyGooglePhoto(googlePicture);
      if ("error" in res && res.error) {
        throw new Error(res.error);
      }
      return "imageUrl" in res ? res.imageUrl : undefined;
    },
    onSuccess: (imageUrl) => {
      patchImage({ imageUrl: imageUrl ?? googlePicture });
      toast.success("Profile photo updated.");
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update photo.",
      );
    },
  });

  const isApplying = bannerMutation.isPending || avatarMutation.isPending;

  return (
    <div className="space-y-8">
      <section>
        <Label>Profile Photo</Label>
        <div className="mt-2 space-y-4 rounded-lg border p-4">
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
            {uploadsAvailable && (
              <Button type="button" onClick={() => pickFile("avatar")}>
                <ImagePlusIcon className="size-4" />
                Upload photo
              </Button>
            )}

            {googlePicture && (
              <Button
                type="button"
                variant="outline"
                disabled={googlePhotoMutation.isPending}
                onClick={() => googlePhotoMutation.mutate()}
              >
                {googlePhotoMutation.isPending && (
                  <Loader2Icon className="size-4 animate-spin" />
                )}
                Use Google Photo
              </Button>
            )}
          </div>
        </div>
      </section>

      <section>
        <Label>Banner</Label>
        <div className="mt-2 space-y-3 rounded-lg border p-4">
          <div className="relative w-full overflow-hidden rounded-md bg-muted aspect-[3/1]">
            {user.bannerImageUrl && (
              // biome-ignore lint/performance/noImgElement: user image off our R2 CDN; avoids next/image optimization cost
              <img
                src={user.bannerImageUrl}
                alt="Current banner"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex justify-end gap-2">
            {user.bannerImageUrl && (
              <Button
                type="button"
                variant="outline"
                disabled={removeBannerMutation.isPending}
                onClick={() => removeBannerMutation.mutate()}
              >
                {removeBannerMutation.isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <Trash2Icon className="size-4" />
                )}
                Remove
              </Button>
            )}
            {uploadsAvailable && (
              <Button type="button" onClick={() => pickFile("banner")}>
                <ImageIcon className="size-4" />
                {user.bannerImageUrl ? "Change banner" : "Add banner"}
              </Button>
            )}
          </div>
        </div>
      </section>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setCropTarget({ kind: pickKind.current, file });
          e.target.value = "";
        }}
      />

      <ImageCropDialog
        open={cropTarget !== null}
        file={cropTarget?.file ?? null}
        aspect={cropTarget?.kind === "banner" ? BANNER_ASPECT : 1}
        round={cropTarget?.kind === "avatar"}
        title={cropTarget?.kind === "banner" ? "Crop banner" : "Crop photo"}
        maxSourceBytes={
          cropTarget?.kind === "banner"
            ? MAX_BANNER_SOURCE_BYTES
            : MAX_AVATAR_SOURCE_BYTES
        }
        busy={isApplying}
        onCancel={closeCrop}
        onApply={(crop) => {
          if (!cropTarget) return;
          const payload = { file: cropTarget.file, crop };
          if (cropTarget.kind === "banner") {
            bannerMutation.mutate(payload);
          } else {
            avatarMutation.mutate(payload);
          }
        }}
      />
    </div>
  );
}

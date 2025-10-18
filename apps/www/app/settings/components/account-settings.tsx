"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { Button } from "@umamin/ui/components/button";
import { Card, CardHeader } from "@umamin/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@umamin/ui/components/collapsible";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronsUpDownIcon,
  Loader2Icon,
  ScanFaceIcon,
  ShieldAlertIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  previewGravatarAvatarAction,
  updateAvatarAction,
} from "@/app/actions/user";
import type { UserWithAccount } from "@/types/user";
import { DangerSettings } from "./danger-settings";
import { PasswordForm } from "./password-form";

export function AccountSettings({ user }: { user: UserWithAccount }) {
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

      toast.success("Profile photo updated");
      setGravatarPreview(res.imageUrl ?? null);
      queryClient.invalidateQueries({ queryKey: ["current_user"] });
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
      setGravatarPreview(res.imageUrl ?? null);
      queryClient.invalidateQueries({ queryKey: ["current_user"] });
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

  return (
    <div>
      {!!user.account && (
        <>
          <Label>Connected Account</Label>
          <Card className="mt-2">
            <CardHeader className="flex flex-row space-x-4 items-center">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  className="rounded-full"
                  src={user.account.picture ?? ""}
                  alt="Profile Picture"
                />
                <AvatarFallback className="md:text-4xl text-xl">
                  <ScanFaceIcon />
                </AvatarFallback>
              </Avatar>

              <div className="text-sm">
                <p>{user.account.email}</p>

                <p className="text-muted-foreground">
                  Linked{" "}
                  {formatDistanceToNow(user.account.createdAt, {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </CardHeader>
          </Card>
        </>
      )}

      {!user?.passwordHash && (
        <Alert className="mt-8">
          <ShieldAlertIcon className="h-5 w-5" />
          <AlertTitle>Password (optional)</AlertTitle>
          <AlertDescription>
            You can have another way of logging in by adding a password.
          </AlertDescription>
        </Alert>
      )}

      {!user.account && (
        <Alert>
          <AlertTitle>Link Account</AlertTitle>
          <AlertDescription>
            <span>
              To prevent account loss, you may connect your account with Google.
              You can still login with your credentials.
            </span>
            <Button variant="secondary" asChild className="mt-6">
              <Link href="/auth/google" className="w-full">
                Connect with Google
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section className="mt-8 space-y-4">
        <Label htmlFor="gravatar-email">Profile Photo</Label>

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
      </section>

      <Collapsible defaultOpen={true}>
        <CollapsibleTrigger asChild className="w-full">
          <Button
            variant="secondary"
            className="flex items-center justify-between text-muted-foreground mt-8 w-full"
          >
            <p>{user?.passwordHash ? "Change Password" : "Set a Password"}</p>

            <ChevronsUpDownIcon className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <PasswordForm passwordHash={user?.passwordHash} />
        </CollapsibleContent>
      </Collapsible>

      <DangerSettings />
    </div>
  );
}

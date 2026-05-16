"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Link2OffIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { SettingsTabs } from "./settings-tabs";
import { SignOutButton } from "./sign-out-button";

export function SettingsContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl tracking-tight font-semibold">Settings</h2>
        <SignOutButton />
      </div>

      <p className="text-sm text-muted-foreground mb-12">
        Manage your account settings
      </p>

      {error === "already_linked" && (
        <Alert variant="destructive" className="mb-4">
          <Link2OffIcon />
          <AlertTitle>Failed to link account</AlertTitle>
          <AlertDescription>
            Google account already connected to a different profile.
          </AlertDescription>
        </Alert>
      )}

      <SettingsTabs />
    </>
  );
}

"use client";

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
import { Label } from "@umamin/ui/components/label";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronsUpDownIcon,
  KeyIcon,
  ScanFaceIcon,
  ShieldAlertIcon,
} from "lucide-react";
import Link from "next/link";
import type { UserWithAccount } from "@/types/user";
import { DangerSettings } from "./danger-settings";
import { PasswordForm } from "./password-form";

export function AccountSettings({ user }: { user: UserWithAccount }) {
  return (
    <div className="space-y-8">
      {!!user.account && (
        <section>
          <Label>Google Account</Label>
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
        </section>
      )}

      {!user?.passwordHash && (
        <Alert>
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

      <Collapsible defaultOpen={true}>
        <CollapsibleTrigger asChild className="w-full">
          <Button
            variant="secondary"
            className="flex items-center justify-between text-muted-foreground border w-full"
          >
            <span className="flex items-center gap-2">
              <KeyIcon className="size-4" />
              <p>{user?.passwordHash ? "Change Password" : "Set a Password"}</p>
            </span>

            <ChevronsUpDownIcon className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 rounded-lg p-4 pt-4 border">
          <PasswordForm passwordHash={user?.passwordHash} />
        </CollapsibleContent>
      </Collapsible>

      <DangerSettings />
    </div>
  );
}

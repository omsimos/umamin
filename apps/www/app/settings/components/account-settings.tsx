"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronsUpDownIcon,
  ScanFaceIcon,
  ShieldAlertIcon,
} from "lucide-react";

import { PasswordForm } from "./password-form";
import { DangerSettings } from "./danger-settings";

import { Label } from "@umamin/ui/components/label";
import { Button } from "@umamin/ui/components/button";
import { Card, CardHeader } from "@umamin/ui/components/card";
import { Alert, AlertDescription, AlertTitle } from "@umamin/ui/components/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@umamin/ui/components/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@umamin/ui/components/collapsible";
import { UserWithAccount } from "@/types/user";

export function AccountSettings({ user }: { user: UserWithAccount }) {
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

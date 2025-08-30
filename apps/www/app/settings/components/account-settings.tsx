"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronsUpDownIcon,
  ScanFaceIcon,
  ShieldAlertIcon,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PasswordForm } from "./password-form";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUserAction } from "@/app/actions/user";
import { Label } from "@/components/ui/label";
import { Card, CardHeader } from "@/components/ui/card";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DangerSettings } from "./danger-settings";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function AccountSettings() {
  const { data } = useQuery({
    queryKey: ["current_user"],
    queryFn: getCurrentUserAction,
  });

  const account = useMemo(
    () => (data?.user?.accounts?.length ? data?.user.accounts[0] : null),
    [data?.user?.accounts],
  );

  return (
    <div>
      {!!account && (
        <>
          <Label>Connected Account</Label>
          <Card className="mt-2">
            <CardHeader className="flex-row space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  className="rounded-full"
                  src={account.picture ?? ""}
                  alt="Profile Picture"
                />
                <AvatarFallback className="md:text-4xl text-xl">
                  <ScanFaceIcon />
                </AvatarFallback>
              </Avatar>

              <div className="text-sm">
                <p>{account.email}</p>

                <p className="text-muted-foreground">
                  Linked{" "}
                  {formatDistanceToNow(account.createdAt, {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </CardHeader>
          </Card>
        </>
      )}

      {!data?.user?.passwordHash && (
        <Alert className="mt-8">
          <ShieldAlertIcon className="h-5 w-5" />
          <AlertTitle>Password (optional)</AlertTitle>
          <AlertDescription>
            You can have another way of logging in by adding a password.
          </AlertDescription>
        </Alert>
      )}

      {!account && (
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
            variant="outline"
            className="flex items-center justify-between text-muted-foreground mt-8 w-full"
          >
            <p>
              {data?.user?.passwordHash ? "Change Password" : "Set a Password"}
            </p>

            <ChevronsUpDownIcon className="size-4" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <PasswordForm passwordHash={data?.user?.passwordHash} />
        </CollapsibleContent>
      </Collapsible>

      <DangerSettings />
    </div>
  );
}

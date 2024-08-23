import Link from "next/link";
import { ScanFace, ShieldAlert } from "lucide-react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../../../components/ui/alert";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../../components/ui/avatar";
import { DangerSettings } from "./danger";
import { AccountForm } from "./account-form";
import { CurrentUserResult } from "../queries";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { Card, CardHeader } from "../../../components/ui/card";

export function AccountSettings({
  user,
  pwdHash,
}: {
  user: CurrentUserResult;
  pwdHash?: string | null;
}) {
  const account = user?.accounts?.length ? user.accounts[0] : null;

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
                  <ScanFace />
                </AvatarFallback>
              </Avatar>

              <div className="text-sm">
                <p>{account.email}</p>

                <p className="text-muted-foreground">
                  Linked{" "}
                  {formatDistanceToNow(fromUnixTime(account.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </CardHeader>
          </Card>
        </>
      )}

      {!pwdHash && (
        <Alert className="mt-8">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Password (optional)</AlertTitle>
          <AlertDescription>
            You can have another way of logging in by adding a password.
          </AlertDescription>
        </Alert>
      )}

      {!account && (
        <Alert>
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Link Account</AlertTitle>
          <AlertDescription>
            To prevent account loss, you may connect your account with Google.
            You can still login with your credentials.
          </AlertDescription>
          <Button variant="secondary" asChild className="mt-6 w-full">
            <Link href="/login/google">Connect with Google</Link>
          </Button>
        </Alert>
      )}

      <AccountForm pwdHash={pwdHash} />
      <DangerSettings />
    </div>
  );
}

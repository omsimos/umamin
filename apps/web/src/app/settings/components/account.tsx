import Link from "next/link";
import { ScanFace, ShieldAlert } from "lucide-react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";

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
import { UserByIdResult } from "../queries";
import { Label } from "@umamin/ui/components/label";
import { Button } from "@umamin/ui/components/button";
import { Card, CardHeader } from "@umamin/ui/components/card";
import { AccountForm } from "./account-form";

export function AccountSettings({
  user,
  pwdHash,
}: {
  user: UserByIdResult;
  pwdHash?: string | null;
}) {
  const profile = user?.profile?.length ? user.profile[0] : null;

  return (
    <div>
      {!!profile && (
        <>
          <Label>Profile</Label>
          <Card className="mt-2">
            <CardHeader className="flex-row space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage
                  className="rounded-full"
                  src={profile.picture ?? ""}
                  alt="Profile Picture"
                />
                <AvatarFallback className="md:text-4xl text-xl">
                  <ScanFace />
                </AvatarFallback>
              </Avatar>

              <div className="text-sm">
                <p>{profile.email}</p>

                <p className="text-muted-foreground">
                  Linked{" "}
                  {formatDistanceToNow(fromUnixTime(profile.createdAt), {
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

      {!profile && (
        <Alert>
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle>Link Account</AlertTitle>
          <AlertDescription>
            To prevent account loss, you may connect your profile with Google.
            You can still login with your credentials.
          </AlertDescription>
          <Button variant="secondary" asChild className="mt-6 w-full">
            <Link href="/login/google">Connect with Google</Link>
          </Button>
        </Alert>
      )}

      <AccountForm pwdHash={pwdHash} />
    </div>
  );
}

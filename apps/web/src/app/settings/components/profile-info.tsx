import { ScanFace } from "lucide-react";
import { formatDistanceToNow, fromUnixTime } from "date-fns";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@umamin/ui/components/avatar";
import { UserByIdResult } from "../queries";
import { Label } from "@umamin/ui/components/label";
import { Card, CardHeader } from "@umamin/ui/components/card";

export function ProfileInfo({
  ...profile
}: NonNullable<NonNullable<UserByIdResult>["profile"]>[0]) {
  return (
    <div className="mb-6">
      <Label>Profile</Label>
      <Card className="mt-2">
        <CardHeader className="flex-row space-x-4">
          <Avatar className="h-16 w-16">
            <AvatarImage
              className="rounded-full"
              src={profile?.picture ?? ""}
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
    </div>
  );
}

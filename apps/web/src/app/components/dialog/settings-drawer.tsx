import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@umamin/ui/components/drawer";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@umamin/ui/components/card";
import { Icons } from "../utilities/icons";
import { SettingsForm } from "../settings-form";
import { SelectUser } from "@umamin/server/db/schema";

export async function SettingsDrawer({ user }: { user: SelectUser }) {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button type="button">
          <Icons.settings />
        </button>
      </DrawerTrigger>
      <DrawerContent className="my-10">
        <Card className="w-full bg-bg border-none max-w-lg mx-auto">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>
              Manage your account settings and set profile preferences.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <SettingsForm user={user} />
          </CardContent>
        </Card>
      </DrawerContent>
    </Drawer>
  );
}

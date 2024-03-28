import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@umamin/ui/components/drawer";

import { cn } from "@umamin/ui/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@umamin/ui/components/card";
import { Icons } from "../utilities/icons";
import { SettingsForm } from "../settings-form";

export function SettingsDrawer() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button type='button'>
          <Icons.settings />
        </button>
      </DrawerTrigger>
      <DrawerContent className='grid place-items-center'>
        <div className='max-w-xl my-10'>
          <SettingsContent />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

type CardProps = React.ComponentProps<typeof Card>;

export function SettingsContent({ className, ...props }: CardProps) {
  return (
    <Card className={cn("w-full bg-bg border-none", className)} {...props}>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Manage your account settings and set profile preferences.
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-4'>
        <SettingsForm />
      </CardContent>
    </Card>
  );
}

import { Button } from "@ui/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@umamin/ui/components/drawer";

import { Check, MessageCircleOff } from "lucide-react";

import { cn } from "@umamin/ui/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@umamin/ui/components/card";
import { Switch } from "@umamin/ui/components/switch";
import { Icons } from "../icons";

export function SettingsDrawer() {
  return (
    <Drawer>
      <DrawerTrigger asChild>
        <button type='button'>
          <Icons.squares />
        </button>
      </DrawerTrigger>
      <DrawerContent className='grid place-items-center'>
        <div className='max-w-xl my-10 px-5'>
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
        <div className=' flex items-center space-x-4 rounded-md border p-4'>
          <MessageCircleOff />
          <div className='flex-1 space-y-1'>
            <p className='text-sm font-medium leading-none'>Pause Link</p>
            <p className='text-sm text-muted-foreground'>
              Temporarily disable receiving anonymous messages.
            </p>
          </div>
          <Switch />
        </div>
      </CardContent>
      <CardFooter>
        <Button className='w-full'>
          <Check className='mr-2 h-4 w-4' />
          Update Profile
        </Button>
      </CardFooter>
    </Card>
  );
}

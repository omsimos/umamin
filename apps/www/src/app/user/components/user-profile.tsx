"use client";

import { toast } from "sonner";
// import { formatDistanceToNow } from "date-fns";
import { Button } from "@umamin/ui/components/button";
// import { ProfileDropdownMenu } from "./profile-dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  // AvatarImage,
} from "@umamin/ui/components/avatar";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import { ScanFace, Settings, Link } from "lucide-react";
import { Card, CardHeader } from "@ui/components/ui/card";

export default function UserProfile() {
  return (
    <main className='container max-w-2xl pt-28 space-y-3'>
      <Card className='border-2'>
        <CardHeader className='rounded-2xl'>
          <div className='flex justify-between py-5'>
            <div className='flex gap-6 items-center'>
              <Avatar className='h-28 w-28'>
                {/* <AvatarImage
              className="rounded-full"
              src={_user?.image as string | undefined}
              alt={`${_user?.username}'s avatar`}
            />
            <AvatarFallback className="text-xs">
              {_user?.username?.split(" ").at(0)}
            </AvatarFallback> */}
                <AvatarFallback>
                  <ScanFace />
                </AvatarFallback>
              </Avatar>
              <div>
                <span className='font-semibold text-xl'>@johndoe</span>
                {/* <p className='text-muted-foreground text-sm mt-1'>
                Joined{" "}
                {formatDistanceToNow(new Date(_user?.createdAt), {
                  addSuffix: true,
                })}
              </p> */}
                <p className='text-muted-foreground text-sm mt-1'>
                  Joined at March 19, 2024
                </p>

                {/* <p
              className={cn("mt-3 text-sm break-words", {
                "break-all": _user?.bio?.split(" ").length === 1,
              })}
            >
              {_user?.bio}
            </p> */}
                <p className='mt-3 break-words text-muted-foreground'>
                  Hello! I'm the qiuck brown fox who jumped on the lazy dog near
                  the bank of the river. 🦊
                </p>
              </div>
            </div>

            {/* Update button if user is not currentUser */}
            <Button
              title='Settings'
              type='button'
              variant='outline'
              onClick={() =>
                toast.message("Copy Link", {
                  description: "Feature coming soon!",
                })
              }
            >
              <Link className='h-5' />
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue='recent' className='w-full'>
        <TabsList className='w-full bg-transparent px-0'>
          <TabsTrigger
            value='recent'
            className='w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-none'
          >
            📥 Recent
          </TabsTrigger>
          <TabsTrigger
            value='sent'
            className='w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-none'
          >
            📩 Sent
          </TabsTrigger>
          <TabsTrigger
            value='status'
            className='w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-none'
          >
            📲 Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value='recent'>
          {/* {_user?.id && <UserPosts authorId={_user.id} />} */}
          <p className='text-center mt-8 text-muted-foreground text-sm'>
            Recent Coming Soon
          </p>
        </TabsContent>

        <TabsContent value='sent'>
          {/* {_user?.id && <UserPosts isComment={true} authorId={_user.id} />} */}
          <p className='text-center mt-8 text-muted-foreground text-sm'>
            Sent Coming soon
          </p>
        </TabsContent>

        <TabsContent value='status'>
          <p className='text-center mt-8 text-muted-foreground text-sm'>
            Status Coming soon
          </p>
        </TabsContent>
      </Tabs>
    </main>
  );
}

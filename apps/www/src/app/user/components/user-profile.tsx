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
import { ScanFace } from "lucide-react";

export default function UserProfile() {
  return (
    <main className='container max-w-2xl pt-28'>
      <section>
        <div className='flex justify-between py-5'>
          <Avatar className='h-20 w-20'>
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

          {/* {isCurrentUser ? (
            <div className='flex flex-col gap-2'>
              <ProfileDropdownMenu />
            </div>
          ) : ( */}
          <div className='flex gap-2'>
            <Button
              title='Follow'
              type='button'
              variant='outline'
              onClick={() =>
                toast.message("Follow User", {
                  description: "Feature coming soon!",
                })
              }
              className=' w-full'
            >
              Follow
            </Button>
          </div>
          {/* )} */}
        </div>

        <div className='flex gap-3 min-w-0'>
          <div>
            <span className='font-semibold text-xl'>@johndoe</span>
            {/* <p className='text-muted-foreground text-sm mt-1'>
                Joined{" "}
                {formatDistanceToNow(new Date(_user?.createdAt), {
                  addSuffix: true,
                })}
              </p> */}
            {/* <p className='text-muted-foreground text-sm mt-1'>
              Joined at March 19, 2024
            </p> */}

            {/* <p
              className={cn("mt-3 text-sm break-words", {
                "break-all": _user?.bio?.split(" ").length === 1,
              })}
            >
              {_user?.bio}
            </p> */}
            <p className='mt-3 text-sm break-words'></p>
          </div>
        </div>
      </section>

      <Tabs defaultValue='recent' className='w-full'>
        <TabsList className='w-full border-b bg-transparent'>
          <TabsTrigger value='recent' className='w-full'>
            Recent
          </TabsTrigger>
          <TabsTrigger value='sent' className='w-full'>
            Sent
          </TabsTrigger>
          <TabsTrigger value='feed' className='w-full'>
            Feed
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

        <TabsContent value='feed'>
          <p className='text-center mt-8 text-muted-foreground text-sm'>
            Feed Coming soon
          </p>
        </TabsContent>
      </Tabs>
    </main>
  );
}

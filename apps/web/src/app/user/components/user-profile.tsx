import React from "react";
import { formatDistanceToNow } from "date-fns";
// import { ProfileDropdownMenu } from "./profile-dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  // AvatarImage,
} from "@umamin/ui/components/avatar";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@umamin/ui/components/tooltip";

import { Card, CardHeader } from "@umamin/ui/components/card";
import { Icons } from "../../components/utilities/icons";
import { RecentMessages } from "./recent-messages";
import { SentMessages } from "./sent-messages";
import { getSession } from "@/lib/auth";

export default async function UserProfile() {
  const { user } = await getSession();

  const tabsData = [
    {
      name: "📥 Recent",
      value: "recent",
      content: () => <RecentMessages />,
    },
    {
      name: "📩 Sent",
      value: "sent",
      content: () => <SentMessages />,
    },
  ];

  return (
    <main className="container max-w-xl space-y-3 lg:mt-36 mt-28">
      <Card className="bg-bg">
        <CardHeader className="rounded-2xl">
          <div className="flex justify-between py-5">
            <div className="flex gap-6 items-center">
              <Avatar className="h-28 w-28">
                <AvatarImage
                  className="rounded-full"
                  src={user?.imageUrl}
                  alt={`${user?.username}'s avatar`}
                />
                <AvatarFallback className="text-xs">
                  {user?.username?.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xl">
                    @{user?.username}
                  </span>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button>
                          <Icons.link className="h-4 text-muted-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Copy profile url</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-muted-foreground text-sm mt-1">
                  Joined{" "}
                  {formatDistanceToNow(new Date(user?.createdAt ?? ""), {
                    addSuffix: true,
                  })}
                </p>

                {/* <p
              className={cn("mt-3 text-sm break-words", {
                "break-all": user?.bio?.split(" ").length === 1,
              })}
            >
              {user?.bio}
            </p> */}
                <p className="mt-3 break-words text-muted-foreground">
                  Hello! I'm the qiuck brown fox who jumped on the lazy dog near
                  the bank of the river. 🦊
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="recent" className="w-full">
        <TabsList className="w-full bg-transparent px-0 flex mb-5">
          {tabsData.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-none font-semibold"
            >
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabsData.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.content()}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}

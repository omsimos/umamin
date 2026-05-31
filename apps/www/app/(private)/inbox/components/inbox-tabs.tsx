"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import { ReceivedMessages } from "./received/received-messages";
import { SentMessages } from "./sent/sent-messages";

export function InboxTabs() {
  return (
    <Tabs defaultValue="received" className="mt-5 w-full">
      <TabsList className="mb-5 w-full">
        <TabsTrigger value="received" className="flex-1 font-semibold">
          Received
        </TabsTrigger>
        <TabsTrigger value="sent" className="flex-1 font-semibold">
          Sent
        </TabsTrigger>
      </TabsList>

      <TabsContent value="received">
        <ReceivedMessages />
      </TabsContent>

      <TabsContent value="sent">
        <SentMessages />
      </TabsContent>
    </Tabs>
  );
}

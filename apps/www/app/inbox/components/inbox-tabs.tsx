"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import dynamic from "next/dynamic";
import { ReceivedMessages } from "./received/received-messages";
import { SentMessages } from "./sent/sent-messages";

const AdContainer = dynamic(() => import("@/components/ad-container"));

export function InboxTabs() {
  return (
    <Tabs defaultValue="received" className="w-full mt-4">
      <TabsList className="w-full bg-transparent flex mb-5">
        <TabsTrigger
          value="received"
          className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-r-none font-semibold"
        >
          Received
        </TabsTrigger>
        <TabsTrigger
          value="sent"
          className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-l-none font-semibold"
        >
          Sent
        </TabsTrigger>
      </TabsList>

      {/* v2-inbox */}
      <AdContainer className="mb-4" slotId="7047998078" />

      <TabsContent value="received">
        <ReceivedMessages />
      </TabsContent>

      <TabsContent value="sent">
        <SentMessages />
      </TabsContent>
    </Tabs>
  );
}

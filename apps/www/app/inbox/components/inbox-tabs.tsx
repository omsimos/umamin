"use client";

import { Tabs, TabsList, TabsTrigger } from "@umamin/ui/components/tabs";
import dynamic from "next/dynamic";
import { Activity, useState } from "react";
import { ReceivedMessages } from "./received/received-messages";
import { SentMessages } from "./sent/sent-messages";

const AdContainer = dynamic(() => import("@/components/ad-container"));

export function InboxTabs() {
  const [selected, setSelected] = useState<"received" | "sent">("received");

  return (
    <Tabs
      defaultValue="received"
      onValueChange={(val) => setSelected(val as "received" | "sent")}
      className="w-full mt-4"
    >
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

      <Activity mode={selected === "received" ? "visible" : "hidden"}>
        <ReceivedMessages />
      </Activity>

      <Activity mode={selected === "sent" ? "visible" : "hidden"}>
        <SentMessages />
      </Activity>
    </Tabs>
  );
}

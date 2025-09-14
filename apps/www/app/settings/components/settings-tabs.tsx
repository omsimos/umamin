"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { AccountSettings } from "./account-settings";
import { PrivacySettings } from "./privacy-settings";
import { GeneralSettings } from "./general-settings";

import { getCurrentUserAction } from "@/app/actions/user";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import { SettingsSkeleton } from "./settings-skeleton";

export function SettingsTabs() {
  const { data, isLoading } = useQuery({
    queryKey: ["current_user"],
    queryFn: getCurrentUserAction,
  });

  const userData = useMemo(() => {
    if (!data?.user) return null;

    const { accounts, ...rest } = data.user;

    return {
      ...rest,
      account: accounts?.length ? accounts[0] : null,
    };
  }, [data?.user]);

  return (
    <Tabs defaultValue="general" className="w-full">
      <TabsList className="w-full bg-transparent px-0 flex mb-8">
        <TabsTrigger
          value="general"
          className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-r-none font-semibold"
        >
          General
        </TabsTrigger>
        <TabsTrigger
          value="account"
          className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-none font-semibold"
        >
          Account
        </TabsTrigger>
        <TabsTrigger
          value="privacy"
          className="w-full data-[state=active]:border-border border-secondary transition-color border-b rounded-l-none font-semibold"
        >
          Privacy
        </TabsTrigger>
      </TabsList>

      {isLoading || !userData ? (
        <SettingsSkeleton />
      ) : (
        <>
          <TabsContent value="general">
            <GeneralSettings user={userData} />
          </TabsContent>

          <TabsContent value="account">
            <AccountSettings user={userData} />
          </TabsContent>

          <TabsContent value="privacy">
            <PrivacySettings user={userData} />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}

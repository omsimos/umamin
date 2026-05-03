"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@umamin/ui/components/tabs";
import { AlertCircleIcon } from "lucide-react";
import { useMemo } from "react";
import { pageQueryOptions, queryKeys } from "@/lib/query";
import { queryErrorMessage } from "@/lib/query-errors";
import { fetchCurrentUser } from "@/lib/query-fetchers";
import { AccountSettings } from "./account-settings";
import { GeneralSettings } from "./general-settings";
import { PrivacySettings } from "./privacy-settings";
import { SettingsSkeleton } from "./settings-skeleton";

export function SettingsTabs() {
  const { data, error, isLoading } = useQuery({
    ...pageQueryOptions(queryKeys.currentUser(), fetchCurrentUser),
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

      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4" />
          <AlertTitle>Couldn't load settings</AlertTitle>
          <AlertDescription>
            {queryErrorMessage(error, "Please refresh and try again.")}
          </AlertDescription>
        </Alert>
      ) : isLoading || !userData ? (
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

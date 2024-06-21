"use client";

import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { useRouter } from "next/navigation";
import { CircleUserRound, MessageCircleOff } from "lucide-react";

import { formatError } from "@/lib/utils";
import { client } from "@/lib/gql/client";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";

import type { CurrentUserResult } from "../queries";

const UPDATE_PICTURE_MUTATION = graphql(`
  mutation UpdatePicture($imageUrl: String) {
    updatePicture(imageUrl: $imageUrl)
  }
`);

const UPDATE_QUIET_MODE_MUTATION = graphql(`
  mutation UpdateQuietMode($quietMode: Boolean!) {
    updateQuietMode(quietMode: $quietMode)
  }
`);

export function PrivacySettings({ user }: { user: CurrentUserResult }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [picture, setPicture] = useState(!!user?.imageUrl);
  const [quietMode, setQuietMode] = useState(user?.quietMode);

  const toggleDisplayPicture = async () => {
    setLoading(true);

    if (!user?.accounts?.length) {
      toast.error("Google account not connected");
      setLoading(false);
      return;
    }

    const res = await client.mutation(UPDATE_PICTURE_MUTATION, {
      imageUrl: picture ? null : user?.accounts[0]?.picture,
    });

    if (res.error) {
      toast.error(formatError(res.error.message));
      setLoading(false);
      return;
    }

    setPicture((prev) => !prev);
    toast.success(`Picture ${!picture ? "is now" : "is no longer"} displaying`);
    setLoading(false);
    router.refresh();
  };

  const toggleQuietMode = async () => {
    setLoading(true);

    const res = await client.mutation(UPDATE_QUIET_MODE_MUTATION, {
      quietMode: !quietMode,
    });

    if (res.error) {
      toast.error(formatError(res.error.message));
      setLoading(false);
      return;
    }

    setQuietMode((prev) => !prev);
    toast.success(`Quiet mode ${!quietMode ? "enabled" : "disabled"}`);
    setLoading(false);
    router.refresh();
  };

  return (
    <section>
      <Label>Update Preferences</Label>
      <div className=" flex items-center space-x-4 rounded-md border p-4 mt-2">
        <CircleUserRound />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium leading-none">Display Picture</p>
          <p className="text-sm text-muted-foreground">
            Show picture from connected account
          </p>
        </div>
        <Switch
          disabled={loading}
          checked={picture}
          onCheckedChange={toggleDisplayPicture}
        />
      </div>

      <div className=" flex items-center space-x-4 rounded-md border p-4 mt-4">
        <MessageCircleOff />
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium leading-none">Quiet Mode</p>
          <p className="text-sm text-muted-foreground">
            Temporarily disable incoming messages
          </p>
        </div>
        <Switch
          disabled={loading}
          checked={quietMode}
          onCheckedChange={toggleQuietMode}
        />
      </div>
    </section>
  );
}

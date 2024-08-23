"use client";

import { toast } from "sonner";
import { useState } from "react";
import { graphql } from "gql.tada";
import { useRouter } from "next/navigation";
import { logEvent } from "firebase/analytics";
import { CircleUserRound, MessageCircleOff } from "lucide-react";

import client from "@/lib/gql/client";
import { formatError } from "../../..//lib/utils";
import { analytics } from "../../../lib/firebase";
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

const updatePicturePersisted = graphql.persisted(
  "84fbec200028bf15058bc1addbef6e960ac4013dfb8c03205440e89e9f6cb19d",
  UPDATE_PICTURE_MUTATION
);

const updateQuietModePersisted = graphql.persisted(
  "8c072442a1cbead14dc07404113b1dc2e3473fbd060fb5658f2c0acf6189a6c7",
  UPDATE_QUIET_MODE_MUTATION
);

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

    const res = await client.mutation(updatePicturePersisted, {
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

    logEvent(analytics, "toggle_display_picture");
  };

  const toggleQuietMode = async () => {
    setLoading(true);

    const res = await client.mutation(updateQuietModePersisted, {
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

    logEvent(analytics, "toggle_quiet_mode");
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

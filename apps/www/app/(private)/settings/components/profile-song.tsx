"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Label } from "@umamin/ui/components/label";
import { Loader2Icon, Music2Icon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { updateProfileMusicAction } from "@/app/actions/user";
import { MusicEmbed } from "@/components/music-embed";
import { SongAttachDialog } from "@/components/song-attach-dialog";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import type { MusicAttachment } from "@/lib/music";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser, patchUserProfile } from "@/lib/query-cache";
import type {
  CurrentUserResponse,
  UserProfileResponse,
} from "@/lib/query-types";
import type { UserWithAccount } from "@/types/user";

export function ProfileSong({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const submit = useSingleFlightAction(updateProfileMusicAction);

  const music = user.music ?? null;

  // Mirror ProfileMedia: keep the current-user cache (drives this form) and the
  // public profile cache in sync so the change is reflected without a refetch.
  const patchMusic = (next: MusicAttachment | null) => {
    queryClient.setQueryData<CurrentUserResponse>(
      queryKeys.currentUser(),
      (current) =>
        patchCurrentUser(current, (currentUser) => ({
          ...currentUser,
          music: next,
        })),
    );
    queryClient.setQueryData<UserProfileResponse>(
      queryKeys.userProfile(user.username),
      (current) =>
        patchUserProfile(current, (currentUser) => ({
          ...currentUser,
          music: next,
        })),
    );
  };

  const attachMutation = useMutation({
    mutationFn: async (musicUrl: string) => {
      const res = await submit({ musicUrl });
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.music;
    },
    onSuccess: (next) => {
      patchMusic(next);
      toast.success("Profile song updated.");
      setOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't update song.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await submit({});
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.music;
    },
    onSuccess: () => {
      patchMusic(null);
      toast.success("Profile song removed.");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Couldn't remove song.");
    },
  });

  const busy = attachMutation.isPending || removeMutation.isPending;

  return (
    <section>
      <Label>Profile Song</Label>
      <div className="mt-2 space-y-3 rounded-lg border p-4">
        <p className="text-xs text-muted-foreground">
          Pin a song from Spotify, Apple Music, SoundCloud, or YouTube Music to
          your profile.
        </p>

        {music ? (
          <>
            <MusicEmbed music={music} className="mt-0" />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => removeMutation.mutate()}
              >
                {removeMutation.isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <Trash2Icon className="size-4" />
                )}
                Remove
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => setOpen(true)}
              >
                <Music2Icon className="size-4" />
                Change song
              </Button>
            </div>
          </>
        ) : (
          <div className="flex justify-end">
            <Button type="button" disabled={busy} onClick={() => setOpen(true)}>
              <Music2Icon className="size-4" />
              Add a song
            </Button>
          </div>
        )}
      </div>

      <SongAttachDialog
        open={open}
        onOpenChange={setOpen}
        // The stored value is a canonical token, not the original URL — paste a
        // fresh link to change it (Remove lives on the control above).
        value=""
        onAttach={(url) => attachMutation.mutate(url)}
        onRemove={() => removeMutation.mutate()}
        description="Paste a link from Spotify, Apple Music, SoundCloud, or YouTube Music and it'll play right on your profile."
      />
    </section>
  );
}

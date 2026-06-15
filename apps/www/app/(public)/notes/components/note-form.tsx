"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import { Textarea } from "@umamin/ui/components/textarea";
import {
  Loader2Icon,
  MessageSquareShareIcon,
  Music2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createNoteAction } from "@/app/actions/note";
import { MUSIC_PROVIDER_LABEL, parseMusicUrl } from "@/lib/music";
import { queryKeys } from "@/lib/query";
import { upsertNote } from "@/lib/query-cache";
import type { NoteItem, NotesResponse } from "@/lib/query-types";
import type { PublicUser } from "@/types/user";
import { NoteSongDialog } from "./note-song-dialog";

const PROMPTS = [
  "currently overthinking about…",
  "confess something harmless",
  "drop a hot take",
  "say it into the void",
  "what's living in your head rent-free?",
];

export function NoteForm({ currentUser }: { currentUser: PublicUser }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [songOpen, setSongOpen] = useState(false);
  // Only ever holds "" or a validated song URL — the dialog commits valid links
  // only, so the composer never has to reason about a half-typed bad one.
  const [musicUrl, setMusicUrl] = useState("");

  const parsedMusic = musicUrl ? parseMusicUrl(musicUrl) : null;
  // A note needs words or a song.
  const canSubmit = content.trim().length > 0 || !!parsedMusic;
  // Randomized after mount — picking during render would mismatch the SSR HTML.
  const [placeholder, setPlaceholder] = useState(PROMPTS[0]);

  useEffect(() => {
    setPlaceholder(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  }, []);

  const updateNoteMutation = useMutation({
    mutationFn: createNoteAction,
    onMutate: async (nextValues) => {
      // Cancel in-flight fetches so a settling refetch can't overwrite the
      // optimistic note (mirrors reply-form.tsx).
      await queryClient.cancelQueries({ queryKey: queryKeys.currentNote() });
      await queryClient.cancelQueries({ queryKey: queryKeys.notesRoot() });

      const previousNote = queryClient.getQueryData<NoteItem | null>(
        queryKeys.currentNote(),
      );
      // Snapshot every viewer-keyed notes query (mirrors use-create-post).
      const previousNotes = queryClient.getQueriesData<
        InfiniteData<NotesResponse>
      >({ queryKey: queryKeys.notesRoot() });

      // Show the song immediately; title + cover fill in from the server's
      // oEmbed lookup when the action resolves.
      const optimisticRef = nextValues.musicUrl
        ? parseMusicUrl(nextValues.musicUrl)
        : null;

      const optimisticNote: NoteItem = {
        id:
          (previousNote as NoteItem | null | undefined)?.id ??
          `optimistic-${crypto.randomUUID()}`,
        userId: currentUser.id,
        // Mirrors the schema's .default("") — the input type is optional.
        content: nextValues.content ?? "",
        // Mirrors the schema's .default(false) — the input type is optional.
        isAnonymous: nextValues.isAnonymous ?? false,
        // Server resets reactions on every upsert — mirror that optimistically.
        reactionCount: 0,
        music: optimisticRef
          ? { ...optimisticRef, title: null, thumbnail: null }
          : null,
        createdAt:
          (previousNote as NoteItem | null | undefined)?.createdAt ??
          new Date(),
        updatedAt: new Date(),
        user: nextValues.isAnonymous ? undefined : currentUser,
      };

      queryClient.setQueryData<NoteItem | null>(
        queryKeys.currentNote(),
        optimisticNote,
      );
      queryClient.setQueriesData<InfiniteData<NotesResponse>>(
        { queryKey: queryKeys.notesRoot() },
        (current) => upsertNote(current, optimisticNote),
      );

      return {
        previousNote,
        previousNotes,
      };
    },
    onSuccess: (data, _values, ctx) => {
      if (data && "error" in data && data.error) {
        // The action returns { error } without throwing, so roll back the
        // optimistic note here (onError never fires for this path).
        queryClient.setQueryData<NoteItem | null>(
          queryKeys.currentNote(),
          ctx?.previousNote,
        );
        for (const [key, value] of ctx?.previousNotes ?? []) {
          queryClient.setQueryData(key, value);
        }
        toast.error(data.error ?? "Couldn't share note.");
        return;
      }

      if (data && "note" in data && data.note) {
        const note = data.note;
        queryClient.setQueryData<NoteItem | null>(
          queryKeys.currentNote(),
          note,
        );
        queryClient.setQueriesData<InfiniteData<NotesResponse>>(
          { queryKey: queryKeys.notesRoot() },
          (current) =>
            upsertNote(current, {
              ...note,
              user: note.isAnonymous ? undefined : currentUser,
            }),
        );
      }

      toast.success("Note's out there.");

      setContent("");
      setMusicUrl("");
      setSongOpen(false);
    },
    onError: (err, _values, ctx) => {
      console.log(err);
      queryClient.setQueryData<NoteItem | null>(
        queryKeys.currentNote(),
        ctx?.previousNote,
      );
      for (const [key, value] of ctx?.previousNotes ?? []) {
        queryClient.setQueryData(key, value);
      }
      toast.error("Couldn't share note.");
    },
  });

  return (
    <section>
      <Textarea
        disabled={updateNoteMutation.isPending}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        id="message"
        placeholder={placeholder}
        className="font-display md:text-base"
      />

      {parsedMusic && (
        <div className="mt-2 flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <Music2Icon className="size-4 shrink-0 text-emerald-500" />
          <button
            type="button"
            onClick={() => setSongOpen(true)}
            disabled={updateNoteMutation.isPending}
            className="flex-1 truncate text-left text-sm hover:underline disabled:no-underline"
          >
            {MUSIC_PROVIDER_LABEL[parsedMusic.provider]} song attached &middot;
            tap to change
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove song"
            disabled={updateNoteMutation.isPending}
            onClick={() => setMusicUrl("")}
            className="size-7"
          >
            <XIcon />
          </Button>
        </div>
      )}

      <NoteSongDialog
        open={songOpen}
        onOpenChange={setSongOpen}
        value={musicUrl}
        onAttach={setMusicUrl}
        onRemove={() => setMusicUrl("")}
      />

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-2">
          <Switch
            checked={isAnonymous}
            disabled={updateNoteMutation.isPending}
            onCheckedChange={setIsAnonymous}
            id="anonymous-mode"
          />
          <Label
            htmlFor="anonymous-mode"
            className="font-mono text-xs text-muted-foreground"
          >
            {isAnonymous ? "as nobody" : `as @${currentUser.username}`}
          </Label>
        </div>

        <div className="flex items-center gap-2">
          {!parsedMusic && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Add a song"
              disabled={updateNoteMutation.isPending}
              onClick={() => setSongOpen(true)}
            >
              <Music2Icon />
            </Button>
          )}

          <Button
            disabled={updateNoteMutation.isPending || !canSubmit}
            onClick={() =>
              updateNoteMutation.mutate({
                content: content.trim(),
                isAnonymous,
                musicUrl: parsedMusic ? musicUrl : undefined,
              })
            }
          >
            {updateNoteMutation.isPending ? (
              <Loader2Icon className="animate-spin" />
            ) : (
              <MessageSquareShareIcon />
            )}
            Put it out there
          </Button>
        </div>
      </div>
    </section>
  );
}

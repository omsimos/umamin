"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import { Textarea } from "@umamin/ui/components/textarea";
import { Loader2Icon, MessageSquareShareIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { createNoteAction } from "@/app/actions/note";
import { queryKeys } from "@/lib/query";
import { upsertNote } from "@/lib/query-cache";
import type { NoteItem, NotesResponse } from "@/lib/query-types";
import type { PublicUser } from "@/types/user";

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

      const optimisticNote: NoteItem = {
        id:
          (previousNote as NoteItem | null | undefined)?.id ??
          `optimistic-${crypto.randomUUID()}`,
        userId: currentUser.id,
        content: nextValues.content,
        isAnonymous: nextValues.isAnonymous,
        // Server resets reactions on every upsert — mirror that optimistically.
        reactionCount: 0,
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
      if (data?.error) {
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

      if (data?.note) {
        queryClient.setQueryData<NoteItem | null>(
          queryKeys.currentNote(),
          data.note,
        );
        queryClient.setQueriesData<InfiniteData<NotesResponse>>(
          { queryKey: queryKeys.notesRoot() },
          (current) =>
            upsertNote(current, {
              ...data.note,
              user: data.note.isAnonymous ? undefined : currentUser,
            }),
        );
      }

      toast.success("Note's out there.");

      setContent("");
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
        required
        disabled={updateNoteMutation.isPending}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        id="message"
        placeholder={placeholder}
        className="font-display md:text-base"
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

        <Button
          disabled={updateNoteMutation.isPending || !content}
          onClick={() =>
            updateNoteMutation.mutate({
              content: content.trim(),
              isAnonymous,
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
    </section>
  );
}

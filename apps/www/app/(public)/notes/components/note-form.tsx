"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import { Textarea } from "@umamin/ui/components/textarea";
import { Loader2Icon, MessageSquareShareIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { createNoteAction } from "@/app/actions/note";
import { queryKeys } from "@/lib/query";
import { upsertNote } from "@/lib/query-cache";
import type { NoteItem, NotesResponse } from "@/lib/query-types";
import type { PublicUser } from "@/types/user";

export function NoteForm({ currentUser }: { currentUser: PublicUser }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const updateNoteMutation = useMutation({
    mutationFn: createNoteAction,
    onMutate: async (nextValues) => {
      const previousNote = queryClient.getQueryData<NoteItem | null>(
        queryKeys.currentNote(),
      );
      const previousNotes = queryClient.getQueryData<
        InfiniteData<NotesResponse>
      >(queryKeys.notes());

      const optimisticNote: NoteItem = {
        id:
          (previousNote as NoteItem | null | undefined)?.id ??
          `optimistic-${crypto.randomUUID()}`,
        userId: currentUser.id,
        content: nextValues.content,
        isAnonymous: nextValues.isAnonymous,
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
      queryClient.setQueryData<InfiniteData<NotesResponse>>(
        queryKeys.notes(),
        (current) => upsertNote(current, optimisticNote),
      );

      return {
        previousNote,
        previousNotes,
      };
    },
    onSuccess: (data) => {
      if (data?.error) {
        toast.error(data.error ?? "Couldn't share note.");
        return;
      }

      if (data?.note) {
        queryClient.setQueryData<NoteItem | null>(
          queryKeys.currentNote(),
          data.note,
        );
        queryClient.setQueryData<InfiniteData<NotesResponse>>(
          queryKeys.notes(),
          (current) =>
            upsertNote(current, {
              ...data.note,
              user: data.note.isAnonymous ? undefined : currentUser,
            }),
        );
      }

      toast.success("Note shared.");

      setContent("");
    },
    onError: (err, _values, ctx) => {
      console.log(err);
      queryClient.setQueryData<NoteItem | null>(
        queryKeys.currentNote(),
        ctx?.previousNote,
      );
      queryClient.setQueryData<InfiniteData<NotesResponse>>(
        queryKeys.notes(),
        ctx?.previousNotes,
      );
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
        placeholder="How's your day going"
      />

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-2">
          <Switch
            checked={isAnonymous}
            disabled={updateNoteMutation.isPending}
            onCheckedChange={setIsAnonymous}
            id="anonymous-mode"
          />
          <Label htmlFor="anonymous-mode">Anonymous</Label>
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
          Share Note
        </Button>
      </div>
    </section>
  );
}

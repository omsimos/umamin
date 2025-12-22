"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import { Textarea } from "@umamin/ui/components/textarea";
import { Loader2Icon, MessageSquareShareIcon } from "lucide-react";
import posthog from "posthog-js";
import { useState } from "react";
import { toast } from "sonner";
import { createNoteAction } from "@/app/actions/note";

export function NoteForm() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const updateNoteMutation = useMutation({
    mutationFn: createNoteAction,
    onSuccess: (data) => {
      if (data?.error) {
        toast.error(data.error ?? "Couldn't share note.");
        posthog.capture("note_share_failed", {
          error: data.error,
          is_anonymous: isAnonymous,
        });
        return;
      }

      toast.success("Note shared.");
      queryClient.invalidateQueries({ queryKey: ["current_note"] });

      // Track note shared
      posthog.capture("note_shared", {
        note_length: content.length,
        is_anonymous: isAnonymous,
      });

      setContent("");
    },
    onError: (err) => {
      console.log(err);
      toast.error("Couldn't share note.");

      // Track note share failure
      posthog.capture("note_share_failed", {
        error: err instanceof Error ? err.message : "Unknown error",
        is_anonymous: isAnonymous,
      });
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

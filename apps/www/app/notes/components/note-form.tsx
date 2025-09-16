"use client";

import { toast } from "sonner";
import { useState } from "react";
import { Loader2Icon, MessageSquareShareIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createNoteAction } from "@/app/actions/note";
import { Button } from "@umamin/ui/components/button";
import { Label } from "@umamin/ui/components/label";
import { Switch } from "@umamin/ui/components/switch";
import { Textarea } from "@umamin/ui/components/textarea";

export function NoteForm() {
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);

  const updateNoteMutation = useMutation({
    mutationFn: createNoteAction,
    onSuccess: (data) => {
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Your note has been shared with the community.");
      queryClient.invalidateQueries({ queryKey: ["current_note"] });
      setContent("");
    },
    onError: (err) => {
      console.log(err);
      toast.error("An error occurred while sharing your note.");
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

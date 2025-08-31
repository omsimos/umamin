"use client";

import { useState } from "react";
import { toast } from "sonner";
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

  const mutation = useMutation({
    mutationFn: createNoteAction,
    onSuccess: (data) => {
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("Your note has been shared with the community.");
      setContent("");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["notes"] }),
  });

  return (
    <section>
      <div>
        <Label htmlFor="message" className="h-7">
          Content
          <span className="text-destructive">*</span>
        </Label>
        <Textarea
          required
          disabled={mutation.isPending}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          id="message"
          placeholder="How's your day going"
        />
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center space-x-2">
          <Switch
            checked={isAnonymous}
            disabled={mutation.isPending}
            onCheckedChange={setIsAnonymous}
            id="anonymous-mode"
          />
          <Label htmlFor="anonymous-mode">Anonymous</Label>
        </div>

        <Button
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              content: content.trim(),
              isAnonymous,
            })
          }
        >
          Share Note
        </Button>
      </div>
    </section>
  );
}

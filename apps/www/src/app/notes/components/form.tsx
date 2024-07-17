"use client";

import { toast } from "sonner";
import { graphql } from "gql.tada";
import { logEvent } from "firebase/analytics";
import { Loader2, Sparkles } from "lucide-react";
import { FormEventHandler, useState } from "react";

import client from "@/lib/gql/client";
import { NoteCard } from "./display-card";
import { CurrentNoteQueryResult } from "../queries";

import { formatError } from "@/lib/utils";
import { analytics } from "@/lib/firebase";

import { cn } from "@umamin/ui/lib/utils";
import { SelectUser } from "@umamin/db/schema/user";
import { useNoteStore } from "@/store/useNoteStore";
import { Label } from "@umamin/ui/components/label";
import { Button } from "@umamin/ui/components/button";
import { Switch } from "@umamin/ui/components/switch";
import useBotDetection from "@/hooks/use-bot-detection";
import { Textarea } from "@umamin/ui/components/textarea";
import { useDynamicTextarea } from "@/hooks/use-dynamic-textarea";
import { ProgressDialog } from "@/app/components/progress-dialog";

const UPDATE_NOTE_MUTATION = graphql(`
  mutation UpdateNote($content: String!, $isAnonymous: Boolean!) {
    updateNote(content: $content, isAnonymous: $isAnonymous) {
      __typename
      id
      content
      updatedAt
      isAnonymous
    }
  }
`);

const DELETE_NOTE_MUTATION = graphql(`
  mutation DeleteNote {
    deleteNote
  }
`);

const updateNotePersisted = graphql.persisted(
  "ee74fb98a70e158ec538193fef5c090523d87c18151e2d3687bc60def53169f2",
  UPDATE_NOTE_MUTATION
);

const deleteNotePersisted = graphql.persisted(
  "fc93cc2e396e0300768942f32a039bf1e92ddf6e2bcea99af54c537feacdf133",
  DELETE_NOTE_MUTATION
);

type Props = {
  user: SelectUser;
  currentNote?: CurrentNoteQueryResult;
};

export default function NoteForm({ user, currentNote }: Props) {
  useBotDetection();
  const [content, setContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [textAreaCount, setTextAreaCount] = useState(0);
  const inputRef = useDynamicTextarea(content);

  const updatedNote = useNoteStore((state) => state.note);
  const clearNote = useNoteStore((state) => state.clear);
  const updateNote = useNoteStore((state) => state.update);
  const isCleared = useNoteStore((state) => state.isCleared);

  const onClearNote = async () => {
    setIsFetching(true);

    const res = await client.mutation(deleteNotePersisted, {});

    if (res.error) {
      toast.error(formatError(res.error.message));
      setIsFetching(false);
      return;
    }

    clearNote();
    toast.success("Note cleared");

    setIsFetching(false);
  };

  const menuItems = [
    {
      title: "Clear Note",
      onClick: onClearNote,
    },
  ];

  const handleSubmit: FormEventHandler = async (e) => {
    e.preventDefault();
    setIsFetching(true);

    try {
      const res = await client.mutation(updateNotePersisted, {
        content,
        isAnonymous,
      });

      if (res.error) {
        toast.error(formatError(res.error.message));
        setIsFetching(false);
        return;
      }

      if (res.data) {
        setDialogOpen(true);
        setContent("");
        updateNote(res.data.updateNote);
      }

      setIsFetching(false);
      logEvent(analytics, "update_note");
    } catch (err: any) {
      toast.error("An error occured");
      setIsFetching(false);
    }
  };

  return (
    <section>
      <ProgressDialog
        type="Note"
        description="Your previous note will be replaced with the new one."
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <form
        onSubmit={handleSubmit}
        className="mb-8 flex flex-col gap-y-4 items-end container"
      >
        <Textarea
          id="message"
          required
          ref={inputRef}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setTextAreaCount(e.target.value.length);
          }}
          placeholder="How's your day going?"
          className="focus-visible:ring-transparent text-base lg:max-h-[400px] max-h-[250px]"
          autoComplete="off"
        />
        <div className="flex w-full justify-between items-center">
          <div className="flex items-center space-x-2 text-sm">
            <Switch
              checked={isAnonymous}
              onCheckedChange={setIsAnonymous}
              id="airplane-mode"
            />
            <Label
              htmlFor="airplane-mode"
              className={isAnonymous ? "" : "text-muted-foreground"}
            >
              Anonymous
            </Label>
          </div>

          <div className="space-x-3">
            <span
              className={cn(
                textAreaCount > 500 ? "text-red-500" : "text-zinc-500",
                "text-sm"
              )}
            >
              {textAreaCount >= 450 ? 500 - textAreaCount : null}
            </span>

            <Button
              disabled={
                isFetching ||
                !content ||
                textAreaCount > 500 ||
                textAreaCount === 0
              }
              type="submit"
            >
              <p>Share Note</p>
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : (
                <Sparkles className="h-4 w-4 ml-2" />
              )}
            </Button>
          </div>
        </div>
      </form>

      {currentNote && !isCleared && (
        <div className="border-b-2 border-muted border-dashed mb-5 pb-5">
          <p className="text-sm font-medium mb-2 container">Your note</p>
          <NoteCard
            note={updatedNote ? updatedNote : currentNote}
            user={{
              displayName: user.displayName,
              username: user.username,
              imageUrl: user.imageUrl,
            }}
            menuItems={menuItems}
          />
        </div>
      )}

      {!currentNote && updatedNote && (
        <div className="border-b-2 border-muted border-dashed mb-5 pb-5">
          <p className="text-sm font-medium mb-2 container">Your note</p>
          <NoteCard
            note={updatedNote}
            user={{
              displayName: user.displayName,
              username: user.username,
              imageUrl: user.imageUrl,
            }}
            menuItems={menuItems}
          />
        </div>
      )}
    </section>
  );
}

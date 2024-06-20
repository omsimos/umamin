"use client";

import { toast } from "sonner";
import { graphql } from "gql.tada";
import { useRouter } from "next/navigation";
import { logEvent } from "firebase/analytics";
import { Loader2, Sparkles } from "lucide-react";
import { FormEventHandler, useState } from "react";

import { NoteCard } from "./card";
import { client } from "@/lib/gql/client";
import { CurrentNoteQueryResult } from "../queries";

import { formatError } from "@/lib/utils";
import { analytics } from "@/lib/firebase";
import { Label } from "@umamin/ui/components/label";
import { Button } from "@umamin/ui/components/button";
import { Switch } from "@umamin/ui/components/switch";
import { Textarea } from "@umamin/ui/components/textarea";

const UPDATE_NOTE_MUTATION = graphql(`
  mutation UpdateNote($content: String!, $isAnonymous: Boolean!) {
    updateNote(content: $content, isAnonymous: $isAnonymous) {
      __typename
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

type Props = {
  username: string;
  imageUrl?: string | null;
  currentNote?: CurrentNoteQueryResult;
};

export function NoteForm({ username, imageUrl, currentNote }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [noteContent, setNoteContent] = useState(currentNote?.content);
  const [anonymous, setAnonymous] = useState(currentNote?.isAnonymous ?? false);
  const [updatedAt, setUpdatedAt] = useState(currentNote?.updatedAt);

  const onClearNote = () => {
    if (!currentNote) return;

    setIsFetching(true);

    client.mutation(DELETE_NOTE_MUTATION, {}).then((res) => {
      if (res.error) {
        toast.error(formatError(res.error.message));
        setIsFetching(false);
        return;
      }

      if (res.data) {
        setNoteContent("");
        toast.success("Note cleared");
      }

      setIsFetching(false);
    });
  };

  const menuItems = [
    {
      title: "Clear Note",
      onClick: onClearNote,
    },
  ];

  const handleSubmit: FormEventHandler = (e) => {
    e.preventDefault();
    setIsFetching(true);

    client
      .mutation(UPDATE_NOTE_MUTATION, { content, isAnonymous })
      .then((res) => {
        if (res.error) {
          toast.error(formatError(res.error.message));
          setIsFetching(false);
          return;
        }

        if (res.data) {
          setNoteContent(content);
          setContent("");
          setUpdatedAt(res?.data?.updateNote?.updatedAt);
          setAnonymous(res.data.updateNote.isAnonymous);
          toast.success("Note updated");
        }

        setIsFetching(false);
        router.refresh();

        logEvent(analytics, "update_note");
      });
  };

  return (
    <section>
      <form
        onSubmit={handleSubmit}
        className="mb-8 flex flex-col gap-y-4 items-end"
      >
        <Textarea
          id="message"
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          placeholder="How's your day going?"
          className="focus-visible:ring-transparent text-base max-h-[500px]"
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

          <Button
            disabled={isFetching || !content}
            type="submit"
            // disabled={input.trim().length === 0}
          >
            <p>Share Note</p>
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin ml-2" />
            ) : (
              <Sparkles className="h-4 w-4 ml-2" />
            )}
          </Button>
        </div>
      </form>

      {noteContent && (
        <div className="border-b-2 border-muted border-dashed mb-5 pb-5">
          <p className="text-sm font-medium mb-2">Your note</p>
          <NoteCard
            note={{
              ...currentNote,
              isAnonymous: anonymous,
              content: noteContent,
              updatedAt,
            }}
            user={{ username, imageUrl }}
            menuItems={menuItems}
          />
        </div>
      )}
    </section>
  );
}

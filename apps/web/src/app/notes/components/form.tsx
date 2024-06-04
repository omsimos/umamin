"use client";

import { toast } from "sonner";
import { graphql } from "gql.tada";
import { analytics } from "@/lib/firebase";
import { logEvent } from "firebase/analytics";
import { FormEventHandler, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { NoteCard } from "./card";
import { getClient } from "@/lib/gql";
import { NoteByUserIdQueryResult } from "../queries";

import { Label } from "@umamin/ui/components/label";
import { Button } from "@umamin/ui/components/button";
import { Switch } from "@umamin/ui/components/switch";
import { Textarea } from "@umamin/ui/components/textarea";
import { formatError } from "@/lib/utils";

const UPDATE_NOTE_MUTATION = graphql(`
  mutation UpdateNote($content: String!, $isAnonymous: Boolean!) {
    updateNote(content: $content, isAnonymous: $isAnonymous) {
      __typename
      userId
      content
      updatedAt
      isAnonymous
      user {
        __typename
        id
        username
        imageUrl
      }
    }
  }
`);

const DELETE_NOTE_MUTATION = graphql(`
  mutation DeleteNote($userId: String!) {
    deleteNote(userId: $userId)
  }
`);

type Props = {
  currentUserNote?: NoteByUserIdQueryResult;
};

export function NoteForm({ currentUserNote }: Props) {
  const [content, setContent] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  const [currentNote, setCurrentNote] = useState(currentUserNote?.content);
  const [anonymous, setAnonymous] = useState(
    currentUserNote?.isAnonymous ?? false,
  );
  const [updatedAt, setUpdatedAt] = useState(currentUserNote?.updatedAt);

  const onClearNote = () => {
    if (!currentUserNote) return;

    setIsFetching(true);

    getClient()
      .mutation(DELETE_NOTE_MUTATION, { userId: currentUserNote?.userId })
      .then((res) => {
        if (res.error) {
          toast.error(formatError(res.error.message));
          setIsFetching(false);
          return;
        }

        if (res.data) {
          setCurrentNote("");
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

    getClient()
      .mutation(UPDATE_NOTE_MUTATION, { content, isAnonymous })
      .then((res) => {
        if (res.error) {
          toast.error(res.error.message);
          setIsFetching(false);
          return;
        }

        if (res.data) {
          setContent("");
          setCurrentNote(res?.data?.updateNote?.content);
          setUpdatedAt(res?.data?.updateNote?.updatedAt);
          setAnonymous(res.data.updateNote.isAnonymous);
          toast.success("Note updated");
        }

        setIsFetching(false);

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

      {currentNote && (
        <div className="border-b-2 border-muted border-dashed mb-5 pb-5">
          <NoteCard
            note={{
              ...currentUserNote,
              isAnonymous: anonymous,
              content: currentNote,
              updatedAt,
            }}
            menuItems={menuItems}
          />
        </div>
      )}
    </section>
  );
}

"use client";

import { toast } from "sonner";
import { graphql } from "gql.tada";
import { analytics } from "@/lib/firebase";
import { logEvent } from "firebase/analytics";
import { FormEventHandler, useState } from "react";
import { Info, Loader2, Sparkles } from "lucide-react";

import { getClient } from "@/lib/gql";
import { NoteCard } from "./note-card";
import { Button } from "@ui/components/ui/button";
import { NoteByUserIdQueryResult } from "../queries";
import { Textarea } from "@ui/components/ui/textarea";

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
  username: string;
  imageUrl: string | null;
  currentUserNote?: NoteByUserIdQueryResult | null;
};

export function NoteForm({ username, imageUrl, currentUserNote }: Props) {
  const [content, setContent] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [currentNote, setCurrentNote] = useState(currentUserNote?.content);
  const [updatedAt, setUpdatedAt] = useState(currentUserNote?.updatedAt);

  const onClearNote = () => {
    if (!currentUserNote) return;

    setIsFetching(true);

    getClient()
      .mutation(DELETE_NOTE_MUTATION, { userId: currentUserNote?.userId })
      .then((res) => {
        if (res.error) {
          toast.error(res.error.message);
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
      .mutation(UPDATE_NOTE_MUTATION, { content, isAnonymous: false })
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
          className="focus-visible:ring-transparent flex-1 text-base"
          autoComplete="off"
        />
        <div className="flex w-full justify-between items-center">
          <div className="text-muted-foreground text-sm flex items-center">
            <Info className="h-4 w-4 mr-2" />
            <p>Notes are shared to public</p>
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
            menuItems={menuItems}
            note={currentNote}
            updatedAt={updatedAt}
            username={username ?? ""}
            imageUrl={imageUrl}
          />
        </div>
      )}
    </section>
  );
}

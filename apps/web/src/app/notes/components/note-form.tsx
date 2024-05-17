"use client";

import { toast } from "sonner";
import type { User } from "lucia";
import { graphql } from "gql.tada";
import { Loader2, Send } from "lucide-react";
import { FormEventHandler, useState } from "react";

import { NoteItem } from "./note-item";
import { Input } from "@ui/components/ui/input";
import { Button } from "@ui/components/ui/button";
import { getClient } from "@/lib/gql";

const UPDATE_NOTE_MUTATION = graphql(`
  mutation UpdateNote($content: String!) {
    updateNote(content: $content) {
      __typename
      id
      note
      username
      imageUrl
    }
  }
`);

export function NoteForm({ user }: { user?: User | null }) {
  const [content, setContent] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [currentNote, setCurrentNote] = useState(user?.note);

  const handleSubmit: FormEventHandler = (e) => {
    e.preventDefault();
    setIsFetching(true);

    getClient()
      .mutation(UPDATE_NOTE_MUTATION, { content })
      .then((res) => {
        if (res.error) {
          toast.error(res.error.message);
          setIsFetching(false);
          return;
        }

        if (res.data) {
          setContent("");
          setCurrentNote(res.data.updateNote.note);
        }
        setIsFetching(false);
      });
  };

  return (
    <section>
      <form
        onSubmit={handleSubmit}
        className="flex items-center space-x-2 mb-8"
      >
        <Input
          id="message"
          required
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={1000}
          placeholder="How's your day going?"
          className="focus-visible:ring-transparent flex-1 text-base"
          autoComplete="off"
        />
        <Button
          disabled={isFetching}
          type="submit"
          size="icon"
          // disabled={input.trim().length === 0}
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sr-only">Send</span>
        </Button>
      </form>

      {user && currentNote && (
        <div className="border-b-2 border-muted border-dashed mb-5 pb-5">
          <NoteItem
            username={user.username}
            note={currentNote}
            imageUrl={user.imageUrl}
          />
        </div>
      )}
    </section>
  );
}

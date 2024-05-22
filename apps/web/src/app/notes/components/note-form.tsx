"use client";

import { toast } from "sonner";
import type { User } from "lucia";
import { graphql } from "gql.tada";
import { FormEventHandler, useState } from "react";
import { Info, Loader2, Sparkles } from "lucide-react";

import { getClient } from "@/lib/gql";
import { NoteCard } from "./note-card";
import { Button } from "@ui/components/ui/button";
import { Textarea } from "@ui/components/ui/textarea";

const UPDATE_NOTE_MUTATION = graphql(`
  mutation UpdateNote($content: String) {
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

  const onClearNote = () => {
    setIsFetching(true);

    getClient()
      .mutation(UPDATE_NOTE_MUTATION, { content: null })
      .then((res) => {
        if (res.error) {
          toast.error(res.error.message);
          setIsFetching(false);
          return;
        }

        if (res.data) {
          setCurrentNote(null);
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
          toast.success("Note updated");
        }

        setIsFetching(false);
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

      {user && currentNote && (
        <div className="border-b-2 border-muted border-dashed mb-5 pb-5">
          <div id={user.id}>
            <NoteCard
              menuItems={menuItems}
              username={user.username}
              note={currentNote}
              imageUrl={user.imageUrl}
            />
          </div>
        </div>
      )}
    </section>
  );
}

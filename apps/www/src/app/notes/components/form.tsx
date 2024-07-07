"use client";

import { toast } from "sonner";
import { graphql } from "gql.tada";
import { logEvent } from "firebase/analytics";
import { Loader2, Sparkles } from "lucide-react";
import {
  FormEventHandler,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { NoteCard } from "./card";
import { client } from "@/lib/gql/client";
import { CurrentNoteQueryResult } from "../queries";

import { formatError } from "@/lib/utils";
import { analytics } from "@/lib/firebase";
import useBotDetection from "@/hooks/useBotDetection";

import { SelectUser } from "@umamin/db/schema/user";
import { useNoteStore } from "@/store/useNoteStore";
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
  user: SelectUser;
  currentNote?: CurrentNoteQueryResult;
};

export function NoteForm({ user, currentNote }: Props) {
  useBotDetection();
  const [content, setContent] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [textAreaCount, setTextAreaCount] = useState(0);

  const updatedNote = useNoteStore((state) => state.note);
  const clearNote = useNoteStore((state) => state.clear);
  const updateNote = useNoteStore((state) => state.update);
  const isCleared = useNoteStore((state) => state.isCleared);

  const onClearNote = async () => {
    setIsFetching(true);

    const res = await client.mutation(DELETE_NOTE_MUTATION, {});

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

    const res = await client.mutation(UPDATE_NOTE_MUTATION, {
      content,
      isAnonymous,
    });

    if (res.error) {
      toast.error(formatError(res.error.message));
      setIsFetching(false);
      return;
    }

    if (res.data) {
      setContent("");
      updateNote(res.data.updateNote);
      toast.success("Note updated");
    }

    setIsFetching(false);
    logEvent(analytics, "update_note");
  };

  // Dynamic Textarea Height

  const textAreaRef = useRef<HTMLTextAreaElement>();

  function updateTextAreaSize(textArea?: HTMLTextAreaElement) {
    if (textArea == null) return;
    textArea.style.height = "3rem";
    textArea.style.height = `${textArea.scrollHeight}px`;
  }

  const inputRef = useCallback((textArea: HTMLTextAreaElement) => {
    updateTextAreaSize(textArea);
    textAreaRef.current = textArea;
  }, []);

  useEffect(() => {
    updateTextAreaSize(textAreaRef.current);
  }, [content]);

  return (
    <section>
      <form
        onSubmit={handleSubmit}
        className="mb-8 flex flex-col gap-y-4 items-end container"
      >
        <Textarea
          id="message"
          required
          ref={inputRef}
          value={content}
          style={{ height: 0 }}
          onChange={(e) => {
            setContent(e.target.value);
            setTextAreaCount(e.target.value.length);
          }}
          // maxLength={500}
          placeholder="How's your day going?"
          className="focus-visible:ring-transparent text-base max-h-[400px]"
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
              className={textAreaCount > 500 ? "text-red-500" : "text-zinc-500"}
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

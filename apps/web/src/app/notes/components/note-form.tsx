import { toast } from "sonner";
import { ResultOf, graphql } from "gql.tada";
import { useMutation } from "@urql/next";
import { FormEventHandler, useState } from "react";

import { Loader2, Send } from "lucide-react";
import { Input } from "@ui/components/ui/input";
import { Button } from "@ui/components/ui/button";
import { NoteItem } from "./note-item";

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

export function NoteForm() {
  const [res, updateNoteFn] = useMutation(UPDATE_NOTE_MUTATION);
  const [content, setContent] = useState("");

  const [currentUser, setCurrentUser] = useState<
    ResultOf<typeof UPDATE_NOTE_MUTATION>["updateNote"] | null
  >(null);

  const handleSubmit: FormEventHandler = (e) => {
    e.preventDefault();

    updateNoteFn({ content }).then((res) => {
      if (res.error) {
        toast.error(res.error.message);
        return;
      }

      if (res.data) {
        setContent("");
        setCurrentUser(res.data.updateNote);
      }
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
          disabled={res.fetching}
          type="submit"
          size="icon"
          // disabled={input.trim().length === 0}
        >
          {res.fetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="sr-only">Send</span>
        </Button>
      </form>

      {currentUser && (
        <div className="border-b border-muted mb-5 pb-5">
          <NoteItem
            username={currentUser.username}
            note={currentUser.note!}
            imageUrl={currentUser.imageUrl}
          />
        </div>
      )}
    </section>
  );
}
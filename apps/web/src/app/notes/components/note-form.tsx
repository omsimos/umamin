import { toast } from "sonner";
import { graphql } from "gql.tada";
import { FormEventHandler, useState } from "react";
import { useMutation } from "@urql/next";
import { Loader2, Send } from "lucide-react";
import { Input } from "@ui/components/ui/input";
import { Button } from "@ui/components/ui/button";

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

  const handleSubmit: FormEventHandler = (e) => {
    e.preventDefault();

    updateNoteFn({ content }).then((res) => {
      if (res.error) {
        toast.error(res.error.message);
        return;
      }

      setContent("");
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2 mb-8">
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
  );
}

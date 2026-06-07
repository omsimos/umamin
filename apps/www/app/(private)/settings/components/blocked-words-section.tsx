"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { Input } from "@umamin/ui/components/input";
import { Label } from "@umamin/ui/components/label";
import { Loader2Icon, XIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { updateBlockedWordsAction } from "@/app/actions/user";
import { useSingleFlightAction } from "@/hooks/use-single-flight-action";
import {
  MAX_BLOCKED_WORD_LENGTH,
  MAX_BLOCKED_WORDS,
} from "@/lib/blocked-words";
import { queryKeys } from "@/lib/query";
import { patchCurrentUser } from "@/lib/query-cache";
import type { CurrentUserResponse } from "@/lib/query-types";
import type { UserWithAccount } from "@/types/user";

export function BlockedWordsSection({ user }: { user: UserWithAccount }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const words = user.blockedWords ?? [];

  const updateBlockedWords = useSingleFlightAction(updateBlockedWordsAction);

  const updateMutation = useMutation({
    mutationFn: async (nextWords: string[]) => {
      const res = await updateBlockedWords({ words: nextWords });
      if (res.error || !res.blockedWords) {
        throw new Error(res.error ?? "Couldn't update blocked words.");
      }
      return res.blockedWords;
    },
    onSuccess: (blockedWords) => {
      queryClient.setQueryData<CurrentUserResponse>(
        queryKeys.currentUser(),
        (current) =>
          patchCurrentUser(current, (currentUser) => ({
            ...currentUser,
            blockedWords,
          })),
      );
    },
    onError: (err) => {
      console.error(err);
      toast.error(err.message ?? "Couldn't update blocked words.");
    },
  });

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;

    if (words.some((word) => word.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Already in your list.");
      return;
    }

    if (words.length >= MAX_BLOCKED_WORDS) {
      toast.error(`You can block up to ${MAX_BLOCKED_WORDS} words.`);
      return;
    }

    updateMutation.mutate([...words, trimmed], {
      onSuccess: () => setDraft(""),
    });
  };

  const handleRemove = (word: string) => {
    updateMutation.mutate(words.filter((entry) => entry !== word));
  };

  return (
    <section>
      <Label htmlFor="blocked-word-input">Blocked Words</Label>
      <div className="space-y-4 rounded-md border p-4 mt-2">
        <p className="text-sm text-muted-foreground">
          Messages containing these words or phrases will be discarded. Senders
          are not notified.
        </p>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
        >
          <Input
            id="blocked-word-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a word or phrase"
            maxLength={MAX_BLOCKED_WORD_LENGTH}
            disabled={updateMutation.isPending}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={updateMutation.isPending || !draft.trim()}
          >
            {updateMutation.isPending ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              "Add"
            )}
          </Button>
        </form>

        {words.length > 0 ? (
          <>
            <ul className="flex flex-wrap gap-2">
              {words.map((word) => (
                <li
                  key={word}
                  className="flex items-center gap-1 rounded-md border bg-muted px-2 py-1 text-sm break-all"
                >
                  {word}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${word}`}
                    disabled={updateMutation.isPending}
                    onClick={() => handleRemove(word)}
                    className="size-auto p-0.5 text-muted-foreground hover:bg-transparent"
                  >
                    {/* size-* escapes Button's [&_svg]:size-4 override */}
                    <XIcon className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {words.length}/{MAX_BLOCKED_WORDS}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No blocked words yet.
          </p>
        )}
      </div>
    </section>
  );
}

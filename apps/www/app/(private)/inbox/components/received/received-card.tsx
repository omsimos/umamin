"use client";

import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import type { SelectMessage } from "@umamin/db/schema/message";
import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { MailIcon } from "lucide-react";
import { useState } from "react";
import { openMessageAction } from "@/app/actions/message";
import { vibrate } from "@/lib/haptics";
import { queryKeys } from "@/lib/query";
import { patchMessage } from "@/lib/query-cache";
import type { MessagesResponse } from "@/lib/query-types";
import { ReceivedMessageMenu } from "./received-card-menu";

// Session-scoped, not component state: the virtualized row unmounts when
// scrolled away, and an in-flight refetch can clobber the optimistic cache
// patch with the stale sealed row — without this, a remount re-seals a
// message the user already read.
const revealedIds = new Set<string>();

export function ReceivedMessageCard({ data }: { data: SelectMessage }) {
  const queryClient = useQueryClient();
  const [revealed, setRevealed] = useState(() => revealedIds.has(data.id));
  const sealed = !data.openedAt && !revealed;

  const handleOpen = () => {
    revealedIds.add(data.id);
    setRevealed(true);
    vibrate(10);
    queryClient.setQueryData<InfiniteData<MessagesResponse>>(
      queryKeys.receivedMessages(),
      (current) =>
        patchMessage(current, data.id, (message) => ({
          ...message,
          openedAt: new Date(),
        })),
    );
    // Fire-and-forget: an error leaves the reveal in place (worst case the
    // envelope shows sealed again next session).
    void openMessageAction({ messageId: data.id });
  };

  if (sealed) {
    const receivedAgo = formatDistanceToNow(data.createdAt, {
      addSuffix: true,
    });

    return (
      <Button
        type="button"
        variant="outline"
        onClick={handleOpen}
        aria-label={`Open anonymous message, received ${receivedAgo}`}
        className="h-auto w-full flex-col gap-1.5 whitespace-normal rounded-xl bg-card p-6 text-center hover:bg-accent/40"
      >
        <MailIcon
          aria-hidden
          className="mb-1 size-7 text-muted-foreground"
          strokeWidth={1.5}
        />
        <p className="font-semibold">You received an anonymous message</p>
        <p className="text-sm text-muted-foreground">Tap to open</p>
        <p className="mt-2 text-muted-foreground text-xs italic">
          {receivedAgo}
        </p>
      </Button>
    );
  }

  return (
    <div id={`umamin-${data.id}`}>
      <div
        className={cn(
          "min-w-2 w-full group relative bg-card p-6 rounded-xl border",
          revealed && "motion-safe:animate-reveal-pop",
        )}
      >
        <div className="absolute top-4 right-4 text-muted-foreground">
          <ReceivedMessageMenu
            {...data}
            reply={data.reply}
            updatedAt={data.updatedAt}
          />
        </div>

        <p className="font-bold text-center leading-normal text-lg min-w-0 break-words mb-4">
          {data.question}
        </p>
        <div className="flex w-full flex-col gap-2 rounded-lg p-5 whitespace-pre-wrap bg-muted break-words min-w-0">
          {data.content}
        </div>
        <p className="text-muted-foreground text-sm mt-4 italic text-center">
          {formatDistanceToNow(data.createdAt, {
            addSuffix: true,
          })}
        </p>
      </div>
    </div>
  );
}

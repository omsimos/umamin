"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@umamin/ui/components/button";
import { SquarePenIcon } from "lucide-react";
import Link from "next/link";
import {
  infiniteQueryDefaults,
  PRIVATE_STALE_TIME,
  queryKeys,
} from "@/lib/query";
import { fetchCurrentUserOptional } from "@/lib/query-fetchers";
import { CurrentUserNote } from "./current-user-note";
import { NoteForm } from "./note-form";
import { NoteList } from "./note-list";

// Client-side auth (mirrors FeedClient) so the notes page stays a static,
// publicly cacheable shell with no session work on the server.
export function NotesClient() {
  const { data: currentUser } = useQuery({
    queryKey: queryKeys.currentUser(),
    queryFn: fetchCurrentUserOptional,
    staleTime: PRIVATE_STALE_TIME,
    ...infiniteQueryDefaults,
  });
  const user = currentUser?.user;
  const isAuthResolved = currentUser !== undefined;

  return (
    <div className="space-y-12">
      {user ? (
        <div className="space-y-12">
          <NoteForm currentUser={user} />
          <CurrentUserNote currentUser={user} />
        </div>
      ) : isAuthResolved ? (
        <div className="flex items-center space-x-4 rounded-md border p-4 mb-5">
          <SquarePenIcon />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium leading-none">Umamin Notes</p>
            <p className="text-sm text-muted-foreground">
              got a thought? log in and leave it here
            </p>
          </div>

          <Button asChild>
            <Link href="/login">Login</Link>
          </Button>
        </div>
      ) : null}

      <NoteList isAuthenticated={!!user} currentUserId={user?.id} />
    </div>
  );
}

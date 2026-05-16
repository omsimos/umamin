"use client";

import { Button } from "@umamin/ui/components/button";
import { SquarePenIcon } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/hooks/use-session";
import { toPublicUser } from "@/types/user";
import { CurrentUserNote } from "./current-user-note";
import { NoteForm } from "./note-form";
import { NoteList } from "./note-list";

export function NotesContent() {
  const { data } = useSession();
  const user = data?.user ?? null;
  const currentUser = user ? toPublicUser(user) : null;

  return (
    <>
      {currentUser ? (
        <div className="space-y-12">
          <NoteForm currentUser={currentUser} />
          <CurrentUserNote currentUser={currentUser} />
        </div>
      ) : (
        <div className="flex items-center space-x-4 rounded-md border p-4 mb-5">
          <SquarePenIcon />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium leading-none">Umamin Notes</p>
            <p className="text-sm text-muted-foreground">
              Login to start writing notes
            </p>
          </div>

          <Button asChild>
            <Link href="/login">Login</Link>
          </Button>
        </div>
      )}

      <NoteList isAuthenticated={!!user} />
    </>
  );
}

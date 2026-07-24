import { Button } from "@umamin/ui/components/button";
import { SquarePenIcon } from "lucide-react";
import { ClientOnlyAdContainer } from "@/components/ad-container-client";
import { Link } from "@/lib/navigation";
import { useCurrentUser } from "../-lib/hooks";
import { CurrentUserNote } from "./current-user-note";
import { NoteForm } from "./note-form";
import { NoteList } from "./note-list";

// The viewer is resolved in the notes route loader: `isAuthenticated` drives the
// composer-vs-login-prompt split immediately, and `initialUserId` keys the list
// to match the SSR-hydrated page — no second full-page fetch. The full current
// user is still read for the composer, but only when signed in.
export function NotesClient({
  initialUserId,
  isAuthenticated,
}: {
  initialUserId: string | null;
  isAuthenticated: boolean;
}) {
  const { data: currentUser } = useCurrentUser(isAuthenticated);
  const user = currentUser?.user;

  return (
    <div className="space-y-12">
      {isAuthenticated ? (
        user ? (
          <div className="space-y-12">
            <ClientOnlyAdContainer placement="notes_input_top" />
            <NoteForm currentUser={user} />
            <CurrentUserNote currentUser={user} />
          </div>
        ) : null
      ) : (
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
      )}

      <NoteList
        isAuthenticated={isAuthenticated}
        currentUserId={initialUserId ?? undefined}
      />
    </div>
  );
}

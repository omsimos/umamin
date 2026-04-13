import { Skeleton } from "@umamin/ui/components/skeleton";
import { NoteCardSkeleton } from "./components/note-card-skeleton";

export default function Loading() {
  return (
    <div className="container max-w-xl space-y-12">
      <h1 className="font-extrabold sm:text-5xl text-[9vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-zinc-800 bg-clip-text text-transparent tracking-tighter text-center my-6">
        Umamin Notes
      </h1>

      <div className="rounded-md border p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <Skeleton className="h-24 w-full" />
      </div>

      <div className="space-y-4">
        <NoteCardSkeleton />
        <NoteCardSkeleton />
        <NoteCardSkeleton />
      </div>
    </div>
  );
}

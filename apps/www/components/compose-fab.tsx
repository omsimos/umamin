import { PlusIcon } from "lucide-react";
import Link from "next/link";

// Floating compose button for the feed. Sits above the bottom menu bar on
// mobile; the bar moves to the top on lg, so the offset relaxes there.
export function ComposeFab() {
  return (
    <Link
      href="/compose"
      aria-label="Create post"
      className="fixed bottom-24 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg transition-colors hover:bg-pink-600 lg:bottom-8"
    >
      <PlusIcon className="size-6" />
    </Link>
  );
}

"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { ComposeDialog } from "@/components/compose-dialog";

// Composing happens inline on the feed (dialog), not a separate /compose route:
// the post action stays bound to /feed and we never cross-route navigate, which
// is what caused the production self-call timeout.
export function ComposeFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Create post"
        className="fixed bottom-24 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-pink-500 text-white shadow-lg transition-colors hover:bg-pink-600 lg:bottom-8"
      >
        <PlusIcon className="size-6" />
      </button>

      <ComposeDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

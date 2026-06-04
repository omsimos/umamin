"use client";

import { useState } from "react";

const NOTES = [
  "currently pretending to study",
  "i still think about my 2019 group chat",
  "accepting unsolicited song recs",
  "situationship update: there is no update",
];

const SLOTS = [
  "z-30 rotate-[-2deg]",
  "z-20 translate-x-3 rotate-[5deg] scale-[0.97] opacity-80",
  "z-10 -translate-x-3 rotate-[-7deg] scale-[0.94] opacity-60",
  "z-0 translate-y-2 rotate-[2deg] scale-[0.91] opacity-0",
];

export function DemoNotes() {
  const [front, setFront] = useState(0);

  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        aria-label="Show next note"
        onClick={() => setFront((f) => (f + 1) % NOTES.length)}
        className="group relative grid min-h-44 flex-1 cursor-pointer place-items-center py-4"
      >
        {NOTES.map((note, i) => {
          const slot = (i - front + NOTES.length) % NOTES.length;
          return (
            <div
              key={note}
              aria-hidden={slot !== 0}
              className={`col-start-1 row-start-1 w-56 rounded-md bg-amber-100 p-4 pt-6 text-zinc-900 shadow-lg transition-all duration-500 ${SLOTS[slot]}`}
            >
              <span className="absolute left-1/2 top-2 size-2 -translate-x-1/2 rounded-full bg-primary shadow-sm" />
              <p className="font-display text-lg font-semibold italic leading-snug">
                {note}
              </p>
              <p className="mt-3 text-xs text-zinc-500">— someone, somewhere</p>
            </div>
          );
        })}
        <span className="absolute bottom-0 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
          tap to shuffle thoughts
        </span>
      </button>
      <p className="pt-3 text-sm text-muted-foreground">
        Drop a thought. Strangers reply anonymously.
      </p>
    </div>
  );
}

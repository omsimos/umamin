"use client";

import { useEffect, useState } from "react";

const GLYPHS = "!<>-_\\/[]{}—=+*^?#";

function prefersReducedMotion() {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

export function CipherText({
  words,
  className,
  intervalMs = 2800,
}: {
  words: readonly string[];
  className?: string;
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [display, setDisplay] = useState(words[0] ?? "");

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % words.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [words.length, intervalMs]);

  useEffect(() => {
    const target = words[index] ?? "";
    if (prefersReducedMotion()) {
      setDisplay(target);
      return;
    }

    let revealed = 0;
    const id = setInterval(() => {
      revealed++;
      if (revealed >= target.length) {
        setDisplay(target);
        clearInterval(id);
        return;
      }
      setDisplay(
        target
          .split("")
          .map((ch, i) =>
            i < revealed || ch === " "
              ? ch
              : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          )
          .join(""),
      );
    }, 45);
    return () => clearInterval(id);
  }, [index, words]);

  const longest = words.reduce(
    (a, b) => (b.length > a.length ? b : a),
    words[0] ?? "",
  );

  return (
    <span className={className}>
      <span className="relative inline-block whitespace-nowrap text-left">
        {/* Invisible sizer pins the slot to the longest word so the headline
            doesn't reflow on every cycle. */}
        <span aria-hidden="true" className="invisible">
          {longest}
        </span>
        <span aria-hidden="true" className="absolute inset-0">
          {display}
        </span>
        <span className="sr-only">{words[index]}</span>
      </span>
    </span>
  );
}

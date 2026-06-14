"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function useWindowVirtualizerOffset<TElement extends HTMLElement>() {
  const containerRef = useRef<TElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element || typeof window === "undefined") {
      return;
    }

    let frameId = 0;

    const updateScrollMargin = () => {
      cancelAnimationFrame(frameId);

      frameId = window.requestAnimationFrame(() => {
        // A scroll-lock (e.g. an open Vaul drawer) pins <body> with
        // position:fixed + a negative top offset. While locked, scrollY reads 0
        // even though the body is shifted up, so getBoundingClientRect().top +
        // scrollY returns the wrong document offset — recomputing then shifts
        // every virtualized row and jitters the page, and on a scrolled feed
        // that reflow swallows taps on the open drawer's links. Skip the update
        // while locked; releasing the lock fires another resize that recomputes
        // cleanly. (At scrollY=0 the math is unaffected, which is why it only
        // misbehaves after scrolling.)
        if (document.body.style.position === "fixed") {
          return;
        }

        const nextScrollMargin =
          element.getBoundingClientRect().top + window.scrollY;

        setScrollMargin((current) =>
          current === nextScrollMargin ? current : nextScrollMargin,
        );
      });
    };

    updateScrollMargin();

    const resizeObserver = new ResizeObserver(updateScrollMargin);
    resizeObserver.observe(element);
    resizeObserver.observe(document.body);

    window.addEventListener("resize", updateScrollMargin);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateScrollMargin);
    };
  }, []);

  return {
    containerRef,
    scrollMargin,
  };
}

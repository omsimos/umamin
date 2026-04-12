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

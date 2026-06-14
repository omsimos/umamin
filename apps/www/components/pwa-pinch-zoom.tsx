"use client";

import { useEffect } from "react";

// Disables page pinch-zoom ONLY in the installed app (standalone / TWA), where an
// accidental two-finger zoom leaves the UI stuck zoomed-in and breaks the
// app-like feel. The browser keeps zoom intact for accessibility.
//
// Two mechanisms because no single one covers every engine:
//  - Android/Chromium (the Play Store TWA): the viewport meta governs page zoom,
//    so we tighten it to maximum-scale=1 / user-scalable=no at runtime. The
//    gesture events below never fire here, so the meta is Android's only lever.
//  - iOS home-screen apps: Safari ignores user-scalable, so we also block the
//    proprietary pinch gesture events directly.
export function PwaPinchZoom() {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;

    if (!standalone) return;

    const viewport = document.querySelector('meta[name="viewport"]');
    const original = viewport?.getAttribute("content") ?? null;
    // Append to whatever Next set rather than hardcoding the whole string, so a
    // future viewport config change (in app/layout.tsx) isn't silently dropped
    // for PWA users. Guard against double-applying.
    if (viewport && original !== null && !original.includes("user-scalable")) {
      viewport.setAttribute(
        "content",
        `${original}, maximum-scale=1, user-scalable=no`,
      );
    }

    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", preventGesture, {
      passive: false,
    });
    document.addEventListener("gesturechange", preventGesture, {
      passive: false,
    });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      if (original !== null) {
        viewport?.setAttribute("content", original);
      }
    };
  }, []);

  return null;
}

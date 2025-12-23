"use client";

import { redirect } from "next/navigation";

export function PwaRedirect() {
  if (typeof window !== "undefined") {
    const matchStandalone = window.matchMedia?.(
      "(display-mode: standalone)",
    )?.matches;
    const iosStandalone =
      typeof navigator !== "undefined" &&
      "standalone" in navigator &&
      navigator.standalone === true;

    if (matchStandalone || iosStandalone) {
      redirect("/inbox");
    }
  }

  return null;
}

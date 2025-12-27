"use client";

import { redirect } from "next/navigation";
import { isStandaloneMode } from "@/lib/pwa";

export function PwaRedirect() {
  if (isStandaloneMode()) {
    redirect("/inbox");
  }

  return null;
}

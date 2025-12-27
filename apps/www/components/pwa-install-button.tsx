"use client";

import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@umamin/ui/components/dialog";
import { DownloadIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const matchStandalone = window.matchMedia?.(
    "(display-mode: standalone)",
  )?.matches;
  const iosStandalone =
    typeof navigator !== "undefined" &&
    "standalone" in navigator &&
    navigator.standalone === true;
  return Boolean(matchStandalone || iosStandalone);
}

export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(isStandaloneMode());

    const onDisplayModeChange = () => {
      setIsStandalone(isStandaloneMode());
    };
    window
      .matchMedia?.("(display-mode: standalone)")
      ?.addEventListener("change", onDisplayModeChange);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window
        .matchMedia?.("(display-mode: standalone)")
        ?.removeEventListener("change", onDisplayModeChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const isIos = useMemo(() => isIosDevice(), []);

  if (isStandalone) {
    return null;
  }

  if (installPrompt) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={async () => {
          await installPrompt.prompt();
          await installPrompt.userChoice;
          setInstallPrompt(null);
        }}
      >
        <DownloadIcon className="h-4 w-4" />
        Install
      </Button>
    );
  }

  if (isIos) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <DownloadIcon className="h-4 w-4" />
            Install
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <div className="flex justify-center">
              <Image
                src="/icon-192x192.png"
                alt="Umamin app icon"
                width={50}
                height={50}
                className="border size-12.5 border-border rounded-md mb-2"
              />
            </div>
            <DialogTitle>Install Umamin</DialogTitle>
            <DialogDescription>
              Tap the Share button in your browser, then choose "Add to Home
              Screen".
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}

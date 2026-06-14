"use client";

import { ProgressProvider } from "@bprogress/next/app";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@umamin/ui/components/sonner";
import { ThemeProvider } from "next-themes";
import { PwaPinchZoom } from "@/components/pwa-pinch-zoom";
import { ServiceWorker } from "@/components/service-worker";
import { getQueryClient } from "@/lib/get-query-client";

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ProgressProvider
        height="2px"
        color="#970064"
        options={{ showSpinner: false }}
        shallowRouting
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ProgressProvider>
      <ServiceWorker />
      <PwaPinchZoom />
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}

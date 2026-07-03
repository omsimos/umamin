"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@umamin/ui/components/sonner";
import { ThemeProvider } from "next-themes";
import { getQueryClient } from "@/lib/get-query-client";

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}

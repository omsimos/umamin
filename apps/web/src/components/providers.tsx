import { Toaster } from "@umamin/ui/components/sonner";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { ErrorTracking } from "@/components/error-tracking";
import { NavigationProgress } from "@/components/navigation-progress";
import { PwaPinchZoom } from "@/components/pwa-pinch-zoom";
import { ServiceWorker } from "@/components/service-worker";

// Client providers, ported from apps/www app/providers.tsx. The QueryClient
// provider is NOT here — `routerWithQueryClient` (src/router.tsx) already wraps
// the app with it and shares the router-context client, so mounting a second
// one would fork the cache. The @bprogress ProgressProvider is replaced by the
// router-driven <NavigationProgress /> bar.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NavigationProgress />
      {children}
      <ServiceWorker />
      <ErrorTracking />
      <PwaPinchZoom />
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}

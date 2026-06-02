import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@umamin/ui/components/sonner";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { toast } from "sonner";
import { ThemeProvider } from "../components/theme-provider";
import { ChatSessionProvider } from "../lib/session/chat-context";
import { getSessionId } from "../lib/session/session-id";
import { createConvexTransport } from "../lib/transport/convex-transport";

export const Route = createRootRoute({
  component: RootLayout,
});

// Convex transport when VITE_CONVEX_URL is configured; otherwise the mock
// (ChatSessionProvider's default) keeps tests and offline dev working.
const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;
const transport = convex
  ? createConvexTransport(convex, getSessionId(), (message) => toast(message))
  : undefined;

function RootLayout() {
  const tree = (
    <ThemeProvider>
      <ChatSessionProvider transport={transport}>
        <Outlet />
        <Toaster position="top-center" />
        <TanStackRouterDevtools />
      </ChatSessionProvider>
    </ThemeProvider>
  );
  return convex ? (
    <ConvexProvider client={convex}>{tree}</ConvexProvider>
  ) : (
    tree
  );
}

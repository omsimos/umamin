import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@umamin/ui/components/sonner";
import { ThemeProvider } from "../components/theme-provider";
import { ChatSessionProvider } from "../lib/session/chat-context";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <ThemeProvider>
      <ChatSessionProvider>
        <Outlet />
        <Toaster position="top-center" />
        <TanStackRouterDevtools />
      </ChatSessionProvider>
    </ThemeProvider>
  );
}

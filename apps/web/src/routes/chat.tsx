import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { loadFeatureFlags } from "@/lib/loader-flags";
import { ChatSessionProvider } from "./-umamin-chat/session/chat-context";

// Layout for the lobby (/chat) and the session (/chat/session). Both share one
// transport, so a search started in the lobby survives the hop into the
// session; leaving /chat entirely disposes it and closes the sockets. The
// chrome lives in the children: the lobby has the app navbar, the session is
// full-screen.
export const Route = createFileRoute("/chat")({
  loader: async ({ context }) => {
    const flags = await loadFeatureFlags(context.queryClient);
    if (!flags.chat) throw notFound();
  },
  component: ChatLayout,
});

function ChatLayout() {
  return (
    <ChatSessionProvider>
      <Outlet />
    </ChatSessionProvider>
  );
}

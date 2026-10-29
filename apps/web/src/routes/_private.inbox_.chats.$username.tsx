import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import type { DmPeerResponse } from "@/lib/dm/types";
import { loaderFetchOptional } from "@/lib/loader-fetch";
import { loadFeatureFlags } from "@/lib/loader-flags";
import { privateQueryDefaults, queryKeys } from "@/lib/query";
import { fetchDmPeer } from "@/lib/query-fetchers";
import { pageSeo } from "@/lib/seo";
import { DmConversationScreen, DmUnavailable } from "./-dm/conversation";

// Follow state changes on the other person's device, so always revalidate.
const dmPeerDefaults = { ...privateQueryDefaults, staleTime: 0 };

export const Route = createFileRoute("/_private/inbox_/chats/$username")({
  loader: async ({ context, params }) => {
    const flags = await loadFeatureFlags(context.queryClient);
    if (!flags.dm) throw notFound();
    await context.queryClient.ensureQueryData({
      queryKey: queryKeys.dmPeer(params.username),
      queryFn: () =>
        loaderFetchOptional<DmPeerResponse | null>(
          `/api/dm/peer/${encodeURIComponent(params.username)}`,
          () => fetchDmPeer(params.username),
          null,
          [401, 404],
        ),
      ...dmPeerDefaults,
      revalidateIfStale: true,
    });
  },
  head: ({ params }) =>
    pageSeo({
      title: `Umamin — Chat with @${params.username}`,
      description: "A private conversation on Umamin.",
      robots: "noindex, nofollow",
    }),
  component: ChatPage,
});

function ChatPage() {
  const { username } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: peer } = useQuery({
    queryKey: queryKeys.dmPeer(username),
    queryFn: () => fetchDmPeer(username),
    ...dmPeerDefaults,
  });

  if (!peer) return <DmUnavailable username={username} reason="missing" />;
  if (!peer.canMessage && !peer.hasThread) {
    return <DmUnavailable username={username} reason="not-mutual" />;
  }
  return (
    <DmConversationScreen
      key={peer.peer.id}
      peer={peer.peer}
      onLeave={() => {
        // The list and badge reflect what was just read or sent.
        void queryClient.invalidateQueries({ queryKey: queryKeys.dmThreads() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dmUnread() });
      }}
    />
  );
}

import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";
import { MessageCircleOffIcon } from "lucide-react";
import { GROUP_CHAT_ENABLED } from "@/lib/group";
import { loaderFetchOptional } from "@/lib/loader-fetch";
import { loadViewer } from "@/lib/loader-viewer";
import { Link } from "@/lib/navigation";
import { queryKeys } from "@/lib/query";
import { fetchGroup, fetchGroupViewer } from "@/lib/query-fetchers";
import { pageSeo } from "@/lib/seo";
import type { GroupPageData, GroupViewerResponse } from "@/lib/types";
import { GroupChat } from "./-chat/group-chat";

export const Route = createFileRoute("/groups/$tag/chat")({
  loader: async ({ context, params }) => {
    // Feature off — bail before any session/DB work (mirrors apps/www).
    if (!GROUP_CHAT_ENABLED) {
      return { enabled: false as const };
    }

    const tag = params.tag;

    // The three reads are independent — only the GUARDS below are ordered — so
    // they run together rather than as three serial round trips. Membership is
    // still re-checked on every load (no token to go stale); nothing here is
    // trusted from the client.
    const [group, currentUser, viewer] = await Promise.all([
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.group(tag),
        queryFn: () =>
          loaderFetchOptional<GroupPageData | null>(
            `/api/groups/${tag}`,
            () => fetchGroup(tag),
            null,
            [403, 404],
          ),
      }),
      loadViewer(context.queryClient),
      context.queryClient.ensureQueryData({
        queryKey: queryKeys.groupViewer(tag),
        // Must go through loaderFetchOptional, not fetchGroupViewer directly:
        // the browser fetcher uses a relative URL, which throws in the Worker,
        // so a hard load of this route used to fail its loader on the server.
        queryFn: () =>
          loaderFetchOptional<GroupViewerResponse | null>(
            `/api/groups/${tag}/viewer`,
            () => fetchGroupViewer(tag),
            null,
          ),
      }),
    ]);

    if (!group) {
      throw notFound();
    }

    // Members-only: bounce signed-out visitors and non-members to the group page.
    if (!currentUser?.user) {
      throw redirect({ to: "/groups/$tag", params: { tag } });
    }

    const relationship = viewer?.relationship ?? null;
    if (relationship !== "owner" && relationship !== "member") {
      throw redirect({ to: "/groups/$tag", params: { tag } });
    }

    return {
      enabled: true as const,
      group,
      currentUserId: currentUser.user.id,
      isOwner: relationship === "owner",
    };
  },
  head: () =>
    pageSeo({
      title: "Umamin — Group chat",
      description: "Members-only group chat on Umamin.",
      robots: "noindex, nofollow",
    }),
  component: GroupChatPage,
});

function ChatDisabled({ tag }: { tag: string }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <MessageCircleOffIcon className="size-7 text-muted-foreground" />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Group chat is unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We've temporarily turned off group chat while we work on it. Your group
        and its members are unchanged — check back soon.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href={`/groups/${tag}`}>Back to group</Link>
      </Button>
    </div>
  );
}

function GroupChatPage() {
  const { tag } = Route.useParams();
  const data = Route.useLoaderData();

  if (!data.enabled) {
    return <ChatDisabled tag={tag} />;
  }

  return (
    <GroupChat
      tag={tag}
      group={data.group}
      currentUserId={data.currentUserId}
      isOwner={data.isOwner}
    />
  );
}

import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";
import { MessageCircleOffIcon } from "lucide-react";
import { GROUP_CHAT_ENABLED } from "@/lib/group";
import { loaderFetchOptional } from "@/lib/loader-fetch";
import { Link } from "@/lib/navigation";
import { queryKeys } from "@/lib/query";
import {
  fetchCurrentUserOptional,
  fetchGroup,
  fetchGroupViewer,
} from "@/lib/query-fetchers";
import { pageSeo } from "@/lib/seo";
import type { CurrentUserResponse, GroupPageData } from "@/lib/types";
import { GroupChat } from "./-chat/group-chat";

export const Route = createFileRoute("/groups/$tag/chat")({
  loader: async ({ context, params }) => {
    // Feature off — bail before any session/DB work (mirrors apps/www).
    if (!GROUP_CHAT_ENABLED) {
      return { enabled: false as const };
    }

    const tag = params.tag;
    const group = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.group(tag),
      queryFn: () =>
        loaderFetchOptional<GroupPageData | null>(
          `/api/groups/${tag}`,
          () => fetchGroup(tag),
          null,
          [403, 404],
        ),
    });

    if (!group) {
      throw notFound();
    }

    // Members-only — re-checked on every load (no membership token to go
    // stale). Bounce signed-out + non-members back to the group page.
    const currentUser = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.currentUser(),
      queryFn: () =>
        loaderFetchOptional<CurrentUserResponse>(
          "/api/me",
          fetchCurrentUserOptional,
          {} as CurrentUserResponse,
        ),
    });

    if (!currentUser?.user) {
      throw redirect({ to: "/groups/$tag", params: { tag } });
    }

    const viewer = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.groupViewer(tag),
      queryFn: () => fetchGroupViewer(tag),
    });

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

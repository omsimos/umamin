import { createFileRoute, notFound } from "@tanstack/react-router";
import { loaderFetchOptional } from "@/lib/loader-fetch";
import { loadViewer } from "@/lib/loader-viewer";
import { PUBLIC_STALE_TIME, queryKeys } from "@/lib/query";
import {
  fetchGroup,
  fetchGroupMembersPage,
  fetchGroupViewer,
} from "@/lib/query-fetchers";
import { pageSeo } from "@/lib/seo";
import type {
  GroupMembersResponse,
  GroupPageData,
  GroupViewerResponse,
} from "@/lib/types";
import { GroupPageClient } from "./-groups/group-page-client";

export const Route = createFileRoute("/groups/$tag/")({
  loader: async ({ context, params }) => {
    const tag = params.tag;

    // Group, viewer and the membership relationship are independent, so they run
    // together rather than as three serial round trips. Seeds the same query
    // keys GroupPageClient reads. 403/404 → null → notFound, mirroring apps/www.
    const [group, , viewer] = await Promise.all([
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
        // so a hard load of this route would fail its loader on the server.
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

    // The roster is the page's main content for a member, and its client query
    // is gated on the relationship — without this prime it can only start after
    // hydrate → viewer → members.
    const relationship = viewer?.relationship ?? null;
    if (relationship === "owner" || relationship === "member") {
      await context.queryClient.ensureInfiniteQueryData({
        queryKey: queryKeys.groupMembers(tag),
        queryFn: ({ pageParam }) => {
          const cursor = (pageParam as string | null) ?? null;
          const base = `/api/groups/${tag}/members`;
          return loaderFetchOptional<GroupMembersResponse>(
            cursor ? `${base}?cursor=${cursor}` : base,
            () => fetchGroupMembersPage(tag, cursor),
            { data: [], nextCursor: null },
            [401, 403, 404],
          );
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage: GroupMembersResponse) =>
          lastPage.nextCursor ?? null,
        staleTime: PUBLIC_STALE_TIME,
      });
    }

    return { group };
  },
  head: ({ loaderData }) => {
    const group = loaderData?.group;
    if (!group) {
      return pageSeo({
        title: "Umamin — Group",
        description: "Groups on Umamin.",
        robots: "noindex, nofollow",
      });
    }
    return pageSeo({
      title: `${group.name} (${group.tag}) — Umamin`,
      description: `${group.name} is a group on Umamin with ${group.memberCount} members.`,
      robots: "noindex, nofollow",
    });
  },
  component: GroupPage,
});

function GroupPage() {
  const { tag } = Route.useParams();
  const { group } = Route.useLoaderData();

  return (
    <section className="mx-auto min-h-screen w-full max-w-lg container pb-24">
      <GroupPageClient tag={tag} initialGroup={group} />
    </section>
  );
}

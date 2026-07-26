import { createFileRoute, notFound } from "@tanstack/react-router";
import { loaderFetchOptional } from "@/lib/loader-fetch";
import { queryKeys } from "@/lib/query";
import { fetchGroup } from "@/lib/query-fetchers";
import { pageSeo } from "@/lib/seo";
import type { GroupPageData } from "@/lib/types";
import { GroupPageClient } from "./-groups/group-page-client";

export const Route = createFileRoute("/groups/$tag/")({
  loader: async ({ context, params }) => {
    // Seed the group query (GroupPageClient reads it as initialData) and get the
    // meta for head(). 403/404 → null → notFound, mirroring apps/www.
    const group = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.group(params.tag),
      queryFn: () =>
        loaderFetchOptional<GroupPageData | null>(
          `/api/groups/${params.tag}`,
          () => fetchGroup(params.tag),
          null,
          [403, 404],
        ),
    });

    if (!group) {
      throw notFound();
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

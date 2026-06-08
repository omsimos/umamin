import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getGroupPageData } from "@/lib/server/data";
import { GroupPageClient } from "./group-page-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const group = await getGroupPageData(tag);

  if (!group) {
    return { title: "Umamin — Group" };
  }

  const title = `${group.name} (${group.tag}) — Umamin`;
  return {
    title,
    description: `${group.name} is a group on Umamin with ${group.memberCount} members.`,
    robots: { index: false, follow: false },
  };
}

export default function GroupPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  return (
    <section className="mx-auto min-h-screen w-full max-w-lg container pb-24">
      {/* params is dynamic — awaited inside Suspense so the shell prerenders
          and the cached group meta streams in (cacheComponents). */}
      <Suspense fallback={null}>
        <GroupLoader params={params} />
      </Suspense>
    </section>
  );
}

async function GroupLoader({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const group = await getGroupPageData(tag);

  if (!group) {
    notFound();
  }

  return <GroupPageClient tag={tag} initialGroup={group} />;
}

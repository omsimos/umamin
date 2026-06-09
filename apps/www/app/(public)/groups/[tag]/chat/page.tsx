import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import {
  getGroupPageData,
  getGroupViewerRelationship,
} from "@/lib/server/data";
import { GroupChat } from "./group-chat";

export const metadata: Metadata = {
  title: "Umamin — Group chat",
  robots: { index: false, follow: false },
};

export default function GroupChatPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  return (
    // params + getSession are dynamic — awaited inside Suspense so the shell
    // prerenders (cacheComponents).
    <Suspense fallback={null}>
      <ChatLoader params={params} />
    </Suspense>
  );
}

async function ChatLoader({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const [group, { session }] = await Promise.all([
    getGroupPageData(tag),
    getSession(),
  ]);

  if (!group) {
    notFound();
  }
  // Members-only — bounce non-members (and signed-out) back to the group page,
  // re-checked server-side on every load (no membership token to go stale).
  if (!session) {
    redirect(`/groups/${tag}`);
  }

  const relationship = await getGroupViewerRelationship(
    session.userId,
    group.id,
  );
  if (relationship !== "owner" && relationship !== "member") {
    redirect(`/groups/${tag}`);
  }

  return (
    <GroupChat
      tag={tag}
      group={group}
      currentUserId={session.userId}
      isOwner={relationship === "owner"}
    />
  );
}

import { Button } from "@umamin/ui/components/button";
import { MessageCircleOffIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { GROUP_CHAT_ENABLED } from "@/lib/group";
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

async function ChatLoader({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;

  // Feature is off — bail before any session/DB work and show a disabled state.
  if (!GROUP_CHAT_ENABLED) {
    return <ChatDisabled tag={tag} />;
  }

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

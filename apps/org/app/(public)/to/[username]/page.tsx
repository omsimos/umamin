import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrgAvatar } from "@/components/org-avatar";
import { getOrgByUsername } from "@/lib/server/data";
import { ChatForm } from "./components/chat-form";

type Props = { params: Promise<{ username: string }> };

// The one public, anonymously-hammered surface — serve it from the CDN (ISR)
// instead of a function invocation per hit. Freshness: updateProfileAction
// expires the org tag + path immediately; otherwise the TTL staleness is
// cosmetic since sendMessageAction re-reads acceptingMessages fresh.
export const revalidate = 60;

// Empty: no usernames prerendered at build (no DB there) — this opts the
// route into static generation so each visited path is rendered once on
// demand, cached, and revalidated per the interval above.
export function generateStaticParams(): Array<{ username: string }> {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const org = await getOrgByUsername(username.toLowerCase());
  const name = org?.displayName || `@${org?.username ?? username}`;
  return {
    // absolute: keep the sender-facing tab title free of the app suffix.
    title: org
      ? { absolute: `Send ${name} an anonymous message` }
      : "Not found",
    robots: { index: false, follow: false },
  };
}

// Mobile-first: this is the link orgs share on socials, so it's opened almost
// exclusively on phones — single column, thumb-sized controls, safe-area pad.
export default async function SubmitPage({ params }: Props) {
  const { username } = await params;
  const org = await getOrgByUsername(username.toLowerCase());
  if (!org) notFound();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col items-center gap-3 text-center">
        <OrgAvatar
          displayName={org.displayName}
          username={org.username}
          imageUrl={org.imageUrl}
          size={64}
        />
        <div>
          <h1 className="font-display text-xl font-semibold">
            {org.displayName || `@${org.username}`}
          </h1>
          <p className="text-muted-foreground text-sm">@{org.username}</p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border p-5 sm:p-6">
        <p className="mb-4 text-center text-lg leading-normal font-bold break-words">
          {org.question}
        </p>
        {org.acceptingMessages ? (
          <ChatForm orgId={org.id} />
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">
            This organization is not accepting messages right now.
          </p>
        )}
      </div>

      <p className="text-muted-foreground text-center text-xs">
        Your message is anonymous and encrypted. We never see who you are.
      </p>
    </main>
  );
}

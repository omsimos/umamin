import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarImage } from "@umamin/ui/components/avatar";
import { cn } from "@umamin/ui/lib/utils";
import { BadgeCheckIcon, ShieldUserIcon, TrophyIcon } from "lucide-react";
import type { ReactNode } from "react";
import { BlobatarFallback } from "@/components/blobatar-fallback";
import { GroupBadge } from "@/components/group-badge";
import { LinkTabs } from "@/components/link-tabs";
import { StreakIcon } from "@/components/streak";
import {
  LEADERBOARD_MIN_VALUE,
  LEADERBOARD_RANK_CAP,
  type LeaderboardEntry,
  type LeaderboardTab,
} from "@/lib/leaderboard";
import { Link } from "@/lib/navigation";
import { PRIVATE_STALE_TIME, PUBLIC_STALE_TIME, queryKeys } from "@/lib/query";
import { fetchLeaderboardRank } from "@/lib/query-fetchers";
import { loaderFetchLeaderboard } from "../-lib/loader-queries";

export function LeaderboardClient({
  tab,
  viewerId,
}: {
  tab: LeaderboardTab;
  viewerId: string | null;
}) {
  const { data } = useQuery({
    queryKey: queryKeys.leaderboard(tab),
    queryFn: () => loaderFetchLeaderboard(tab),
    staleTime: PUBLIC_STALE_TIME,
  });
  const entries = data?.entries ?? [];

  return (
    <div>
      <h1 className="mb-4 px-4 font-semibold text-xl sm:px-0">Leaderboard</h1>

      <LinkTabs
        tabs={[
          {
            label: "Aura",
            href: "/leaderboard",
            search: {},
            active: tab === "aura",
          },
          {
            label: "Best streak",
            href: "/leaderboard",
            search: { tab: "streak" },
            active: tab === "streak",
          },
        ]}
      />

      <div className="px-4 sm:px-0">
        <ViewerRankCard tab={tab} viewerId={viewerId} />

        {entries.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground text-sm">
            {tab === "aura"
              ? "No one has earned aura yet."
              : "No one has a streak of 2 days or more yet."}
          </p>
        ) : (
          <ol>
            {entries.map((entry) => (
              <LeaderboardRow
                key={entry.user.id}
                entry={entry}
                tab={tab}
                isViewer={entry.user.id === viewerId}
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function LeaderboardValue({
  tab,
  value,
}: {
  tab: LeaderboardTab;
  value: number;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-sm">
      {tab === "aura" ? (
        <ShieldUserIcon className="size-4 text-muted-foreground" aria-hidden />
      ) : (
        <StreakIcon streak={value} className="size-4" />
      )}
      <span className="font-medium tabular-nums">
        {value.toLocaleString("en-US")}
      </span>
      <span className="text-muted-foreground">
        {tab === "aura" ? "aura" : value === 1 ? "day" : "days"}
      </span>
    </span>
  );
}

export function LeaderboardRow({
  entry,
  tab,
  isViewer,
}: {
  entry: LeaderboardEntry;
  tab: LeaderboardTab;
  isViewer: boolean;
}) {
  const { user, rank } = entry;
  const href = `/user/${user.username}`;
  const isVerified = import.meta.env.VITE_VERIFIED_USERS?.split(",").includes(
    user.username,
  );

  return (
    <li
      aria-current={isViewer ? "true" : undefined}
      className={cn(
        "-mx-2 flex items-center gap-3 rounded-lg px-2 py-3",
        isViewer && "bg-muted",
      )}
    >
      <span
        className={cn(
          "w-7 shrink-0 text-center text-sm tabular-nums",
          rank <= 3
            ? "font-bold text-foreground"
            : "font-medium text-muted-foreground",
        )}
      >
        {rank}
      </span>

      {/* Avatar and name are separate links so the group badge (also a link)
          sits beside them without nesting anchors. */}
      <Link href={href} className="shrink-0" tabIndex={-1} aria-hidden>
        <Avatar className="size-10">
          <AvatarImage src={user.imageUrl ?? ""} alt="" />
          <BlobatarFallback seed={user.id} />
        </Avatar>
      </Link>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <Link
            href={href}
            className="truncate font-medium text-sm hover:underline"
          >
            {user.displayName || user.username}
          </Link>
          {isVerified && (
            <BadgeCheckIcon className="size-3.5 shrink-0 text-pink-500" />
          )}
          <GroupBadge badge={user.groupBadge} />
        </div>
        <p className="truncate text-muted-foreground text-sm">
          @{user.username}
        </p>
      </div>

      <LeaderboardValue tab={tab} value={entry.value} />
    </li>
  );
}

export function ViewerRankCard({
  tab,
  viewerId,
}: {
  tab: LeaderboardTab;
  viewerId: string | null;
}) {
  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.leaderboardRank(viewerId ?? "", tab),
    queryFn: () => fetchLeaderboardRank(tab),
    staleTime: PRIVATE_STALE_TIME,
    enabled: viewerId != null,
  });

  let message: ReactNode = null;

  if (!viewerId) {
    message = (
      <>
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>{" "}
        to see where you rank.
      </>
    );
  } else if (isPending || isError || !data) {
    return null;
  } else if (data.hidden) {
    message = (
      <>
        You're hidden from leaderboards.{" "}
        <Link
          href="/settings"
          search={{ tab: "privacy" }}
          className="font-medium underline"
        >
          Change this in settings
        </Link>
        .
      </>
    );
  } else if (data.rank != null) {
    message = (
      <>
        You're <span className="font-semibold">#{data.rank}</span> with{" "}
        {tab === "aura"
          ? `${data.value.toLocaleString("en-US")} aura`
          : `a ${data.value}-day best streak`}
        .
      </>
    );
  } else if (data.value >= LEADERBOARD_MIN_VALUE[tab]) {
    message = `You're not in the top ${LEADERBOARD_RANK_CAP.toLocaleString("en-US")} yet. Keep going.`;
  } else {
    message =
      tab === "aura"
        ? "Earn aura when people like, comment on or repost your posts."
        : "Post or share a note 2 days in a row to start a streak.";
  }

  return (
    <div className="mt-4 mb-2 flex items-center gap-3 rounded-lg border p-3 text-sm">
      <TrophyIcon className="size-4 shrink-0 text-muted-foreground" />
      <p>{message}</p>
    </div>
  );
}

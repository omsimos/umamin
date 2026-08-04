import { BadgeCheckIcon, Repeat2Icon } from "lucide-react";
import { TimeAgo } from "@/components/time-ago";
import { Link } from "@/lib/navigation";
import type { FeedAuthor } from "@/lib/types";

// Plain-repost attribution line — quotes are real posts with their own card.
export function RepostHeader({
  user,
  createdAt,
}: {
  user: FeedAuthor;
  createdAt: Date;
}) {
  const verified =
    !!user.username &&
    (import.meta.env.VITE_VERIFIED_USERS?.split(",").includes(user.username) ??
      false);

  return (
    <div className="flex px-2 sm:px-0 items-center text-muted-foreground text-sm">
      <Repeat2Icon className="inline size-4 mr-1" />
      <Link
        href={`/user/${user.username}`}
        className="hover:underline mr-1 font-semibold"
      >
        @{user.username}
      </Link>
      {verified && <BadgeCheckIcon className="w-4 h-4 text-pink-500 mr-1" />}
      <span>
        reposted <TimeAgo date={createdAt} />
      </span>
    </div>
  );
}

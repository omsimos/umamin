"use client";

import { UserCardSkeleton } from "@/components/skeleton/user-card-skeleton";
import { UserCard } from "@/components/user-card";
import { useSession } from "@/hooks/use-session";
import { toPublicUser } from "@/types/user";

export function CurrentUserCard() {
  const { data, isPending } = useSession();

  if (isPending) return <UserCardSkeleton />;
  if (!data?.user) return null;

  return <UserCard user={toPublicUser(data.user)} />;
}

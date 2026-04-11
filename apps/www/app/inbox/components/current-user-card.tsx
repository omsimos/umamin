import { UserCard } from "@/components/user-card";
import type { PublicUser } from "@/types/user";

export async function CurrentUserCard({ user }: { user: PublicUser | null }) {
  if (!user) {
    return null;
  }

  return <UserCard user={user} />;
}

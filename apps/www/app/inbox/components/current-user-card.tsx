import { UserCard } from "@/components/user-card";
import { getSession } from "@/lib/auth";

export async function CurrentUserCard() {
  const { user } = await getSession();

  if (!user) {
    return null;
  }

  return <UserCard user={user} />;
}

import { getSession } from "@/lib/auth";
import { UserCard } from "@/components/user-card";

export async function CurrentUserCard() {
  const { user } = await getSession();

  if (!user) {
    return null;
  }

  return <UserCard user={user} />;
}

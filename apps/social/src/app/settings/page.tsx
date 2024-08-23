import { getSession } from "@/lib/auth";
import Settings from "@umamin/ui/app/settings/page";
import { CurrentUserResult, getCurrentUser } from "./queries";
import { redirect } from "next/navigation";

export default async function Page() {
  const { user, session } = await getSession();
  const userData = await getCurrentUser(session?.id);

  if (!user) {
    redirect("/login");
  }

  return <Settings user={user} userData={userData as CurrentUserResult} />;
}

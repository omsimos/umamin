import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ReceivedMessages } from "./components/received/messages";

export default async function Dashboard() {
  const { user, session } = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="max-w-screen-2xl mx-auto mt-32 container">
      <h1 className="text-4xl">Hello, {user?.displayName || user?.username}</h1>
      <ReceivedMessages sessionId={session?.id} />
    </div>
  );
}

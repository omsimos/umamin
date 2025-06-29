import { getSession } from "@/lib/auth";

export default async function InboxPage() {
  const { session } = await getSession();
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1>Inbox</h1>
      {JSON.stringify(session, null, 2)}
    </div>
  );
}

import { getSession } from "@/lib/auth";

export default async function Dashboard() {
  const { user } = await getSession();
  return (
    <div className="max-w-screen-xl mx-auto mt-32 container">
      <h1 className="text-4xl">Hello, {user?.displayName || user?.username}</h1>
    </div>
  );
}

import { logout } from "@/actions";
import { getSession } from "@/lib/auth";
import { Button } from "@umamin/ui/components/button";

export default async function Home() {
  const { session } = await getSession();

  return (
    <main>
      <h1>Hello World</h1>
      {session && (
        <form action={logout}>
          <Button type="submit" variant="outline">
            Sign Out
          </Button>
        </form>
      )}
    </main>
  );
}

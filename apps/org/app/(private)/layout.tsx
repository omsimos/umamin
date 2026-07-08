import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { getSession } from "@/lib/auth";

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, user } = await getSession();
  if (!session || !user) {
    redirect("/login");
  }

  return (
    <div className="min-h-dvh">
      <AppHeader username={user.username} displayName={user.displayName} />
      {/* Desktop-first surface: the dashboard is a work tool — give the grid
          room on large screens (pages that read better narrow re-constrain). */}
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}

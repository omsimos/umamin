import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@umamin/ui/components/button";
import { ShieldAlertIcon } from "lucide-react";
import { Link } from "@/lib/navigation";

export const Route = createFileRoute("/_public/banned")({
  head: () => ({
    meta: [
      { title: "Account suspended — Umamin" },
      { name: "description", content: "This account has been suspended." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BannedPage,
});

function BannedPage() {
  return (
    <section className="container flex min-h-screen max-w-md flex-col items-center justify-center gap-4 text-center">
      <ShieldAlertIcon className="size-12 text-red-500" />
      <h1 className="text-2xl font-semibold tracking-tight">
        Account suspended
      </h1>
      <p className="text-sm text-muted-foreground">
        This account has been suspended for violating Umamin&apos;s community
        guidelines. If you believe this was a mistake, log in with a password
        account to see the reason, or reach out to support.
      </p>
      <Button asChild variant="outline">
        <Link to="/login">Back to login</Link>
      </Button>
    </section>
  );
}

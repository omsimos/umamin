import { createFileRoute } from "@tanstack/react-router";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Link2OffIcon } from "lucide-react";
import BrowserWarning from "@/components/browser-warning";
import { Link } from "@/lib/navigation";
import { pageSeo } from "@/lib/seo";
import { LoginForm } from "./-auth/login-form";
import { useRedirectIfAuthed } from "./-auth/use-redirect-if-authed";

const title = "Umamin — Login";
const description =
  "Log in to Umamin to send and receive encrypted anonymous messages. Secure your privacy and communicate freely.";

export const Route = createFileRoute("/_public/login")({
  // Return type is `{ error?: string }` (key optional) so navigations to
  // /login can omit search entirely — otherwise every `to: "/login"` elsewhere
  // would be forced to pass a search object.
  validateSearch: (search: Record<string, unknown>): { error?: string } => ({
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  // Thin utility page — noindex, still followable. [audit #39]
  head: () =>
    pageSeo({ title, description, path: "/login", robots: "noindex, follow" }),
  component: LoginPage,
});

function LoginPage() {
  useRedirectIfAuthed();
  const { error } = Route.useSearch();

  return (
    <section className="max-w-lg md:max-w-md container min-h-screen">
      <BrowserWarning />

      <div className="mb-6">
        <h2 className="text-2xl tracking-tight font-semibold">
          Umamin Account
        </h2>
        <p className="text-sm text-muted-foreground">
          Proceed with your Umamin profile
        </p>
      </div>

      {error === "no_account" && (
        <Alert variant="destructive" className="mb-6">
          <Link2OffIcon />
          <AlertTitle>No account found</AlertTitle>
          <AlertDescription>
            That Google account isn&apos;t linked to an Umamin account.
          </AlertDescription>
        </Alert>
      )}

      <LoginForm />

      <div className="mt-4 text-center text-sm w-full">
        Don&apos;t have an account?{" "}
        <Link to="/register" className="underline">
          Sign up
        </Link>
      </div>
    </section>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import BrowserWarning from "@/components/browser-warning";
import { Link } from "@/lib/navigation";
import { pageSeo } from "@/lib/seo";
import { RegisterForm } from "./-auth/register-form";
import { useRedirectIfAuthed } from "./-auth/use-redirect-if-authed";

const title = "Umamin — Register";
const description =
  "Create an account on Umamin to start sending and receiving encrypted anonymous messages. Join our secure platform and ensure your privacy today.";

export const Route = createFileRoute("/_public/register")({
  // Thin utility page — noindex, still followable. [audit #39]
  head: () =>
    pageSeo({
      title,
      description,
      path: "/register",
      robots: "noindex, follow",
    }),
  component: RegisterPage,
});

function RegisterPage() {
  useRedirectIfAuthed();

  return (
    <section className="max-w-lg md:max-w-md container min-h-screen">
      <BrowserWarning />

      <div className="mb-6">
        <h2 className="text-2xl tracking-tight font-semibold">
          Umamin Account
        </h2>
        <p className="text-sm text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link to="/privacy" className="font-medium">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link to="/terms" className="font-medium">
            Terms of Service
          </Link>
        </p>
      </div>

      <RegisterForm />

      <div className="mt-4 text-center text-sm w-full">
        Already have an account?{" "}
        <Link to="/login" className="underline">
          Login
        </Link>
      </div>
    </section>
  );
}

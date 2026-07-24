import { createFileRoute } from "@tanstack/react-router";
import BrowserWarning from "@/components/browser-warning";
import { Link } from "@/lib/navigation";
import { RegisterForm } from "./-auth/register-form";
import { useRedirectIfAuthed } from "./-auth/use-redirect-if-authed";

const title = "Umamin — Register";
const description =
  "Create an account on Umamin to start sending and receiving encrypted anonymous messages. Join our secure platform and ensure your privacy today.";

export const Route = createFileRoute("/_public/register")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      // Thin utility page — noindex, still followable. [audit #39]
      { name: "robots", content: "noindex, follow" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: "https://www.umamin.link/register" },
      // Re-declare OG image explicitly (page-level OG shallow-replace gotcha).
      { property: "og:image", content: "/opengraph-image.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: "/twitter-image.png" },
    ],
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

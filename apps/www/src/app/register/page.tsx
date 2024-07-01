import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { V1Link } from "../components/v1-link";
import { RegisterForm } from "./components/form";
import { BrowserWarning } from "@umamin/ui/components/browser-warning";

export default async function Register() {
  const { user } = await getSession();

  if (user) {
    redirect("/inbox");
  }

  return (
    <section className="max-w-lg md:max-w-md container mt-36 min-h-screen">
      <V1Link className="inline-block mb-6 text-sm" />
      <BrowserWarning />

      <div className="mb-6">
        <h2 className="text-2xl tracking-tight font-semibold">
          Umamin Account
        </h2>
        <p className="text-sm text-muted-foreground">
          By creating an account, you agree to our{" "}
          <Link href="/privacy" className="text-zinc-200">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="text-zinc-200">
            Terms of Service
          </Link>
        </p>
      </div>

      <RegisterForm />

      <div className="mt-4 text-center text-sm w-full">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Login
        </Link>
      </div>
    </section>
  );
}

import Link from "next/link";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { RegisterForm } from "./components/form";
import { getSession } from "@umamin/shared/lib/auth";

const BrowserWarning = dynamic(
  () => import("@umamin/ui/components/browser-warning"),
  { ssr: false }
);

export default async function Register({
  redirectPath,
}: {
  redirectPath: string;
}) {
  const { user } = await getSession();

  if (user) {
    redirect(redirectPath);
  }

  return (
    <section className="max-w-lg md:max-w-md container mt-36 min-h-screen">
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

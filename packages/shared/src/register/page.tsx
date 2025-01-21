import Link from "next/link";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { cn } from "@umamin/shared/lib/utils";
import { RegisterForm } from "./components/form";
import { getSession } from "@umamin/shared/lib/auth";

const BrowserWarning = dynamic(
  () => import("@umamin/ui/components/browser-warning")
);

export default async function Register({
  redirectPath,
  className,
}: {
  redirectPath: string;
  className?: string;
}) {
  const { user } = await getSession();

  if (user) {
    redirect(redirectPath);
  }

  return (
    <section
      className={cn("max-w-lg md:max-w-md container min-h-screen", className)}
    >
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

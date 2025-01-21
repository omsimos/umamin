import Link from "next/link";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { LoginForm } from "./components/form";
import { cn } from "@umamin/shared/lib/utils";
import { getSession } from "@umamin/shared/lib/auth";

const BrowserWarning = dynamic(
  () => import("@umamin/ui/components/browser-warning")
);

export default async function Login({
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
          Continue with Umamin
        </h2>
        <p className="text-sm text-muted-foreground">
          Proceed with your created Umamin Account
        </p>
      </div>

      <LoginForm />

      <div className="mt-4 text-center text-sm w-full">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="underline">
          Sign up
        </Link>
      </div>
    </section>
  );
}

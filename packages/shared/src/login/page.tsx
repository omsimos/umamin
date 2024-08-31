import Link from "next/link";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { LoginForm } from "./components/form";
import { getSession } from "@umamin/shared/lib/auth";

const BrowserWarning = dynamic(
  () => import("@umamin/ui/components/browser-warning"),
  { ssr: false }
);

export default async function Login({
  redirectPath,
}: {
  redirectPath: string;
}) {
  const { user } = await getSession();

  if (user) {
    redirect(redirectPath);
  }

  return (
    <>
      <BrowserWarning />
      <section className="max-w-lg md:max-w-md container mt-36 min-h-screen">
        <div className="mb-6">
          <h2 className="text-2xl tracking-tight font-semibold">
            Umamin Account
          </h2>
          <p className="text-sm text-muted-foreground">
            Proceed with your Umamin v2.0 profile
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
    </>
  );
}

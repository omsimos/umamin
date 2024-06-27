import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./components/form";
import { BrowserWarning } from "@umamin/ui/components/browser-warning";

export default async function Login() {
  const { user } = await getSession();

  if (user) {
    redirect("/inbox");
  }

  return (
    <section className="max-w-lg md:max-w-md container mt-36 min-h-screen">
      <BrowserWarning />

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
  );
}

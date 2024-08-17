import Link from "next/link";
import dynamic from "next/dynamic";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./components/form";

const BrowserWarning = dynamic(
  () => import("@umamin/ui/components/browser-warning"),
  { ssr: false }
);

export const metadata = {
  title: "Umamin Partners — Login",
  description:
    "Log in to Umamin Partners to manage anonymous feedback, surveys, and communications securely. Enhance your workflow with powerful tools and maintain privacy at every step.",
  keywords: [
    "Umamin login",
    "anonymous messaging login",
    "encrypted messages login",
  ],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    title: "Umamin Partners — Login",
    description:
      "Log in to Umamin Partners to manage anonymous feedback, surveys, and communications securely. Enhance your workflow with powerful tools and maintain privacy at every step.",
    url: "https://partners.umamin.link/login",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin Partners — Login",
    description:
      "Log in to Umamin Partners to manage anonymous feedback, surveys, and communications securely. Enhance your workflow with powerful tools and maintain privacy at every step.",
  },
};

export default async function Login() {
  const { user } = await getSession();

  if (user) {
    redirect("/dashboard");
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

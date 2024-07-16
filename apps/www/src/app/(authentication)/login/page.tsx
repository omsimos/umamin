import Link from "next/link";
import dynamic from "next/dynamic";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./components/form";
import { V1Link } from "@/app/components/v1-link";

const BrowserWarning = dynamic(
  () => import("@umamin/ui/components/browser-warning"),
);

export const metadata = {
  title: "Umamin — Login",
  description:
    "Log in to Umamin to send and receive encrypted anonymous messages. Secure your privacy and communicate freely.",
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
    title: "Umamin — Login",
    description:
      "Log in to Umamin to send and receive encrypted anonymous messages. Secure your privacy and communicate freely.",
    url: "https://www.umamin.link/login",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin — Login",
    description:
      "Log in to Umamin to send and receive encrypted anonymous messages. Secure your privacy and communicate freely.",
  },
};

export default async function Login() {
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

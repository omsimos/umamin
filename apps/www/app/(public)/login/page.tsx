import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@umamin/ui/components/alert";
import { Link2OffIcon } from "lucide-react";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./components/login-form";

const BrowserWarning = dynamic(() => import("@/components/browser-warning"));

export const metadata: Metadata = {
  title: "Umamin — Login",
  description:
    "Log in to Umamin to send and receive encrypted anonymous messages. Secure your privacy and communicate freely.",
  keywords: [
    "Umamin login",
    "anonymous messaging login",
    "encrypted messages login",
  ],
  // Thin utility page — keep it out of the index (still followable) so it
  // doesn't waste crawl budget or dilute quality signals. [audit #39]
  robots: {
    index: false,
    follow: true,
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

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { session } = await getSession();
  const error = (await searchParams).error;

  if (session) {
    redirect("/inbox");
  }

  return (
    <section className="max-w-lg md:max-w-md container min-h-screen">
      <BrowserWarning />

      <div className="mb-6">
        <h2 className="text-2xl tracking-tight font-semibold">
          Umamin Account
        </h2>
        <p className="text-sm text-muted-foreground">
          Proceed with your Umamin profile
        </p>
      </div>

      {error === "no_account" && (
        <Alert variant="destructive" className="mb-6">
          <Link2OffIcon />
          <AlertTitle>No account found</AlertTitle>
          <AlertDescription>
            That Google account isn&apos;t linked to an Umamin account.
          </AlertDescription>
        </Alert>
      )}

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

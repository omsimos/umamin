import Link from "next/link";
import dynamic from "next/dynamic";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { RegisterForm } from "./components/register-form";

const BrowserWarning = dynamic(() => import("@/components/browser-warning"));

export const metadata = {
  title: "Umamin — Register",
  description:
    "Create an account on Umamin to start sending and receiving encrypted anonymous messages. Join our secure platform and ensure your privacy today.",
  keywords: [
    "Umamin register",
    "sign up for Umamin",
    "anonymous messaging sign up",
  ],
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    type: "website",
    title: "Umamin — Register",
    description:
      "Create an account on Umamin to start sending and receiving encrypted anonymous messages. Join our secure platform and ensure your privacy today.",
    url: "https://www.umamin.link/register",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin — Register",
    description:
      "Create an account on Umamin to start sending and receiving encrypted anonymous messages. Join our secure platform and ensure your privacy today.",
  },
};

export default async function Register() {
  const { session } = await getSession();

  if (session) {
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
          By creating an account, you agree to our{" "}
          <Link href="/privacy" className="font-medium">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="font-medium">
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

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
  title: "Umamin Social — Login",
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
    title: "Umamin Social — Login",
    description:
      "Log in to Umamin to send and receive encrypted anonymous messages. Secure your privacy and communicate freely.",
    url: "https://social.umamin.link/login",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umamin Social — Login",
    description:
      "Log in to Umamin to send and receive encrypted anonymous messages. Secure your privacy and communicate freely.",
  },
};

export default async function Login() {
  const { user } = await getSession();

  if (user) {
    redirect("/");
  }

  return (
    <section className="container pt-16 lg:pt-20 flex flex-col items-center">
      <BrowserWarning />
      <div className="border-b-2 border-muted border-dashed pb-5 mb-10 sm:text-center inline-block">
        <h1 className="font-bold md:text-6xl text-[10vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-clip-text bg-zinc-800 text-transparent tracking-tighter text-nowrap">
          Umamin Social
        </h1>
        <p className="text-muted-foreground md:text-lg mt-2">
          The <span className="text-foreground font-medium">Umamin v2.0</span>{" "}
          Next generation open-source social platform
        </p>
      </div>

      <div className="max-w-md w-full mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl tracking-tight font-semibold">Account</h2>
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
      </div>
    </section>
  );
}

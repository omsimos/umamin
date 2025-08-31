import Link from "next/link";

import { Demo } from "@/components/demo";
import { Button } from "@umamin/ui/components/button";

export default async function Home() {
  return (
    <main className="flex items-center flex-col min-h-screen lg:pt-32 pb-36 md:gap-8 gap-6 container mx-auto">
      <div className="border-b-2 border-muted border-dashed md:pb-8 pb-6">
        <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none dark:bg-gradient-to-b from-foreground dark:to-zinc-400 bg-clip-text bg-zinc-800 text-transparent tracking-tighter text-center">
          The Platform for Anonymity
        </h1>
      </div>
      <p className="text-muted-foreground text-center md:text-xl max-w-2xl">
        A community focused open-source platform for sending and receiving
        encrypted anonymous messages.
      </p>
      <div className="flex items-center gap-2">
        <Button size="lg" className="md:text-base" asChild>
          <Link href="/login">Continue</Link>
        </Button>

        <Button variant="outline" size="lg" asChild className="md:text-base">
          <Link href="/social">Umamin Social</Link>
        </Button>
      </div>
      <Demo />
    </main>
  );
}

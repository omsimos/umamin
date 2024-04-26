import Link from "next/link";
import { cn } from "@ui/lib/utils";
import { buttonVariants } from "@ui/components/ui/button";

export default function Home() {
  return (
    <main className="h-screen grid place-items-center">
      <div className="text-center">
        <h1 className="font-bold text-6xl">Umamin v2</h1>
        <p>The ultimate platform for anonymous messages</p>
        <Link href="/login" className={cn(buttonVariants(), "w-full mt-4")}>
          Continue
        </Link>
      </div>
    </main>
  );
}

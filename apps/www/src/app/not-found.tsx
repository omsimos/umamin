import { Button } from "@umamin/ui/components/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="h-screen grid place-items-center">
      <div className="text-center">
        <h1 className="font-bold text-6xl">Are you lost?</h1>
        <Link href="/" className="mt-5 flex gap-2">
          <Button className="w-full">Back Home</Button>
          <Button className="w-full" variant="secondary">
            View Profile
          </Button>
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function NotFound() {
  return (
    <main className="h-screen grid place-items-center">
      <div className="text-center">
        <h1 className="font-bold md:text-6xl text-4xl mb-4">Oops, Not Found</h1>
        <Link href="/" className="text-muted-foreground underline md:text-base text-sm">
          Go Back &rarr;
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function Social() {
  return (
    <main className="flex items-center flex-col lg:justify-center min-h-screen lg:pt-0 pt-36 container">
      <Link
        className="flex items-center space-x-2 rounded-full bg-gradient-to-b from-zinc-800 to-zinc-900 mb-8 text-sm px-4 py-2"
        href="https://v1.umamin.link"
        target="_blank"
      >
        <p className="text-muted-foreground">Coming Soon!</p>
      </Link>

      <div className="border-y-2 border-muted border-dashed py-8">
        <h1 className="font-extrabold md:text-7xl text-[10vw] leading-none bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-transparent tracking-tighter text-center">
          Umamin Social
        </h1>
      </div>

      <p className="text-muted-foreground mt-8 text-center md:text-xl max-w-2xl">
        An open-source social platform for the Umamin community. Currently under
        development.
      </p>
    </main>
  );
}

import Link from "next/link";

export function Footer() {
  return (
    <footer className="pb-24 lg:pb-8 flex flex-col items-center text-muted-foreground text-sm">
      <div>
        <span>developed</span> by{" "}
        <Link
          className="underline font-medium"
          href="https://www.instagram.com/josh.xfi/"
          target="_blank"
        >
          @josh.xfi
        </Link>{" "}
        and{" "}
        <Link
          className="underline font-medium"
          href="https://github.com/omsimos/umamin/graphs/contributors"
          target="_blank"
        >
          contributors
        </Link>
      </div>
    </footer>
  );
}

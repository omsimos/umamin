import { cn } from "@umamin/ui/lib/utils";

const ITEMS = [
  "say it anonymously",
  "aes-256 encrypted",
  "open source",
  "no names attached",
  "free forever",
];

export function Marquee() {
  return (
    <section className="relative -rotate-1 border-y border-dashed bg-background py-5">
      <p className="sr-only">
        Say it anonymously. AES-256 encrypted. Open source. No names attached.
        Free forever.
      </p>
      <div
        aria-hidden="true"
        className="flex w-max animate-marquee items-center gap-10 motion-reduce:animate-none"
      >
        {[0, 1].map((half) => (
          <ul key={half} className="flex items-center gap-10">
            {ITEMS.map((item, i) => (
              <li key={item} className="flex items-center gap-10">
                <span
                  className={cn(
                    "whitespace-nowrap font-display text-3xl font-extrabold uppercase tracking-tight md:text-4xl",
                    i % 2 === 1 && "text-outline",
                  )}
                >
                  {item}
                </span>
                <span className="text-xl text-primary">✦</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}

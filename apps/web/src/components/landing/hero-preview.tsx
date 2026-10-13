import { Button } from "@umamin/ui/components/button";
import { cn } from "@umamin/ui/lib/utils";
import { blobatarUri } from "blobatar/uri";
import { ArrowRightIcon, MailIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/navigation";

const INCOMING = [
  "you're lowkey the funniest person in the gc",
  "pahiram ng notes sa calc pls 🙏",
  "your playlist got me through finals week",
];

function clean(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 20);
}

/**
 * The hero's right side: type a username and see the profile people would
 * land on, with sealed messages arriving that open on tap. The name carries
 * over to /register.
 */
export function HeroPreview() {
  const [name, setName] = useState("");
  const [arrived, setArrived] = useState(0);
  const [opened, setOpened] = useState<number[]>([]);
  const shown = name || "you";
  const avatar = useMemo(() => blobatarUri(name || "umamin"), [name]);

  useEffect(() => {
    if (arrived >= INCOMING.length) return;
    const id = setTimeout(
      () => setArrived((n) => n + 1),
      arrived === 0 ? 900 : 1800,
    );
    return () => clearTimeout(id);
  }, [arrived]);

  const valid = name.length >= 5;

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-primary/15 blur-3xl"
      />

      <label
        htmlFor="hero-username"
        className="flex items-center rounded-full border bg-card px-4 py-2.5 font-mono text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring"
      >
        <span className="text-muted-foreground">umamin.link/to/</span>
        <input
          id="hero-username"
          value={name}
          onChange={(e) => setName(clean(e.target.value))}
          placeholder="yourname"
          autoComplete="off"
          spellCheck={false}
          aria-label="Pick a username"
          className="min-w-0 flex-1 bg-transparent text-primary outline-none placeholder:text-primary/40"
        />
      </label>

      <div className="mt-4 rounded-3xl border bg-card p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <img
            src={avatar}
            alt=""
            className="size-12 rounded-full bg-muted"
            width={48}
            height={48}
          />
          <div className="min-w-0">
            <p className="truncate font-semibold">@{shown}</p>
            <p className="text-xs text-muted-foreground">
              {arrived} new {arrived === 1 ? "message" : "messages"}
            </p>
          </div>
        </div>

        <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-center text-sm font-semibold">
          Send me an anonymous message!
        </p>

        <ul className="mt-3 grid min-h-[11.5rem] content-start gap-2">
          {INCOMING.slice(0, arrived).map((text, i) => {
            const isOpen = opened.includes(i);
            return (
              <li key={text} className="animate-rise">
                <button
                  type="button"
                  onClick={() =>
                    setOpened((prev) => (isOpen ? prev : [...prev, i]))
                  }
                  aria-label={isOpen ? text : "Open anonymous message"}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    isOpen
                      ? "bg-primary/10 border-primary/30"
                      : "border-dashed hover:bg-muted",
                  )}
                >
                  <MailIcon
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0",
                      isOpen ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  {isOpen ? (
                    <span className="animate-reveal-pop">{text}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Anonymous message · tap to open
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Button size="lg" className="mt-4 w-full rounded-full" asChild>
        <Link to="/register" search={valid ? { username: name } : undefined}>
          {valid ? `Claim umamin.link/to/${name}` : "Claim your link"}
          <ArrowRightIcon />
        </Link>
      </Button>
    </div>
  );
}

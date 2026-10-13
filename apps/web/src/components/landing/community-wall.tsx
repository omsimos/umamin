import { cn } from "@umamin/ui/lib/utils";
import { blobatarUri } from "blobatar/uri";
import {
  CoffeeIcon,
  Gamepad2Icon,
  HeartIcon,
  type LucideIcon,
  MailIcon,
  MessageCircleIcon,
  MusicIcon,
  Repeat2Icon,
  SparklesIcon,
} from "lucide-react";

type Tag = { tag: string; Icon: LucideIcon; accent: string };

const KAPE: Tag = { tag: "KAPE", Icon: CoffeeIcon, accent: "text-amber-500" };
const LOVE: Tag = { tag: "SANA", Icon: HeartIcon, accent: "text-rose-500" };
const GAME: Tag = { tag: "GG4L", Icon: Gamepad2Icon, accent: "text-sky-500" };
const SONG: Tag = { tag: "OPM", Icon: MusicIcon, accent: "text-violet-500" };

type Card =
  | {
      kind: "post";
      user: string;
      group?: Tag;
      text: string;
      likes: number;
      comments: number;
      reposts?: number;
    }
  | { kind: "note"; text: string; song?: string }
  | {
      kind: "poll";
      user: string;
      group?: Tag;
      text: string;
      options: [string, number][];
    }
  | { kind: "message"; question: string; text: string }
  | { kind: "aura"; user: string; group?: Tag; points: number; reason: string };

// Illustrative only: written to sound like the community, not copied from
// real accounts (the landing page shows no user content).
const COLUMNS: Card[][] = [
  [
    {
      kind: "post",
      user: "kape.at.ulan",
      group: KAPE,
      text: "unpopular opinion: 7-eleven siopao at 2am is a whole personality trait",
      likes: 214,
      comments: 38,
      reposts: 12,
    },
    { kind: "note", text: "sana all may tulog", song: "a song for 3am" },
    {
      kind: "message",
      question: "ask me anything",
      text: "where do you get your outfits?? asking for me",
    },
    {
      kind: "poll",
      user: "aral.mode",
      text: "best study spot?",
      options: [
        ["the library", 24],
        ["coffee shop", 51],
        ["bed (lying to myself)", 25],
      ],
    },
  ],
  [
    {
      kind: "aura",
      user: "lakad.lang",
      group: SONG,
      points: 1204,
      reason: "for the playlist thread",
    },
    {
      kind: "post",
      user: "gg.ez.lang",
      group: GAME,
      text: "who's up for a late night valo stack? need 2, no ragers",
      likes: 87,
      comments: 41,
    },
    {
      kind: "note",
      text: "kinda proud of myself today. that's it, that's the note",
    },
    {
      kind: "message",
      question: "send me an anonymous message!",
      text: "thank you for defending me in class last week. you didn't have to",
    },
  ],
  [
    {
      kind: "note",
      text: "accepting unsolicited song recs",
      song: "attached a song",
    },
    {
      kind: "post",
      user: "hindi.pa.tulog",
      group: LOVE,
      text: "the moon is so pretty tonight, go look outside",
      likes: 342,
      comments: 19,
      reposts: 57,
    },
    {
      kind: "poll",
      user: "kape.at.ulan",
      group: KAPE,
      text: "iced coffee in december?",
      options: [
        ["always", 68],
        ["are you okay", 32],
      ],
    },
    {
      kind: "message",
      question: "rate my vibe",
      text: "10/10 would sit next to you on a long jeep ride",
    },
  ],
];

function Name({ user, group }: { user: string; group?: Tag }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <img
        src={blobatarUri(user)}
        alt=""
        width={28}
        height={28}
        className="size-7 shrink-0 rounded-full bg-muted"
      />
      <span className="min-w-0 truncate text-sm font-semibold">{user}</span>
      {group && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">
          <group.Icon className={cn("size-3", group.accent)} aria-hidden />
          {group.tag}
        </span>
      )}
    </div>
  );
}

function WallCard({ card }: { card: Card }) {
  if (card.kind === "note") {
    return (
      <article className="rounded-2xl bg-amber-100 p-4 text-zinc-900 shadow-sm">
        <p className="font-display text-lg font-semibold italic leading-snug">
          {card.text}
        </p>
        {card.song && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-900/10 px-2 py-1 text-xs">
            <MusicIcon className="size-3" aria-hidden />
            {card.song}
          </p>
        )}
        <p className="mt-3 text-xs text-zinc-500">a note from someone</p>
      </article>
    );
  }

  if (card.kind === "message") {
    return (
      <article className="rounded-2xl border bg-card p-4">
        <p className="text-center text-sm font-bold">{card.question}</p>
        <p className="mt-3 rounded-xl bg-muted p-3 text-sm">{card.text}</p>
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <MailIcon className="size-3" aria-hidden />
          anonymous message
        </p>
      </article>
    );
  }

  if (card.kind === "aura") {
    return (
      <article className="rounded-2xl border bg-card p-4">
        <Name user={card.user} group={card.group} />
        <p className="mt-4 flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-extrabold tabular-nums">
            {card.points.toLocaleString("en-US")}
          </span>
          <span className="text-sm text-muted-foreground">aura points</span>
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-primary">
          <SparklesIcon className="size-3" aria-hidden />
          +5 {card.reason}
        </p>
      </article>
    );
  }

  if (card.kind === "poll") {
    return (
      <article className="rounded-2xl border bg-card p-4">
        <Name user={card.user} group={card.group} />
        <p className="mt-3 text-sm">{card.text}</p>
        <ul className="mt-3 grid gap-1.5">
          {card.options.map(([label, pct]) => (
            <li
              key={label}
              className="relative overflow-hidden rounded-lg border px-3 py-1.5 text-xs"
            >
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 bg-primary/15"
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex justify-between gap-2">
                <span className="truncate">{label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {pct}%
                </span>
              </span>
            </li>
          ))}
        </ul>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border bg-card p-4">
      <Name user={card.user} group={card.group} />
      <p className="mt-3 text-sm leading-relaxed">{card.text}</p>
      <p className="mt-3 flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
        <span className="flex items-center gap-1">
          <HeartIcon className="size-3.5" aria-hidden />
          {card.likes}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircleIcon className="size-3.5" aria-hidden />
          {card.comments}
        </span>
        {card.reposts !== undefined && (
          <span className="flex items-center gap-1">
            <Repeat2Icon className="size-3.5" aria-hidden />
            {card.reposts}
          </span>
        )}
      </p>
    </article>
  );
}

/**
 * Slow vertical columns of example posts, notes, polls and messages. Each
 * column renders its cards twice so the -50% scroll loops seamlessly; hovering
 * pauses it, and reduced motion leaves it still.
 */
export function CommunityWall() {
  return (
    <section
      aria-label="Example posts"
      className="relative h-[34rem] overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_88%,transparent)] md:h-[40rem]"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        {COLUMNS.map((column, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed columns
            key={i}
            className={cn(
              "flex animate-scroll-up flex-col gap-3 hover:[animation-play-state:paused] motion-reduce:animate-none md:gap-4",
              i === 1 && "[animation-duration:75s]",
              i === 2 && "hidden [animation-duration:68s] md:flex",
            )}
          >
            {[0, 1].map((copy) =>
              column.map((card, j) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static, duplicated on purpose for the loop
                  key={`${copy}-${j}`}
                  aria-hidden={copy === 1 || undefined}
                >
                  <WallCard card={card} />
                </div>
              )),
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

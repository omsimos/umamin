"use client";

import { cn } from "@umamin/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { useState } from "react";
import {
  MUSIC_PROVIDER_LABEL,
  type MusicAttachment,
  type MusicProvider,
  musicEmbedUrl,
} from "@/lib/music";

const ACCENT: Record<MusicProvider, string> = {
  spotify: "#1db954",
  apple: "#fa243c",
  soundcloud: "#ff5500",
  youtube: "#ff0000",
};

const ALLOW: Record<MusicProvider, string> = {
  spotify:
    "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
  apple: "autoplay *; encrypted-media *; fullscreen *; clipboard-write",
  soundcloud: "autoplay; encrypted-media",
  youtube:
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
};

type Props = {
  music: MusicAttachment;
  className?: string;
};

// A shared, surface-agnostic song embed (notes + profiles). Lazy by design: a
// feed/profile can render many of these, so we never mount a third-party player
// iframe until the listener taps the facade — one tap, one player, no wall of
// frames. The whole element carries data-export-exclude so a saved-as-image
// surface omits the song (a cross-origin iframe can't be captured — see
// saveImage). Spacing is the default mt-3; callers override via className.
export function MusicEmbed({ music, className }: Props) {
  const [loaded, setLoaded] = useState(false);
  const src = musicEmbedUrl(music);
  if (!src) return null;

  const { provider, title, thumbnail } = music;
  const label = MUSIC_PROVIDER_LABEL[provider];
  const accent = ACCENT[provider];
  const frameTitle = title ? `${label}: ${title}` : `${label} player`;

  if (loaded) {
    // YouTube (incl. YT Music) only embeds as a 16:9 video player.
    if (provider === "youtube") {
      return (
        <div
          data-export-exclude
          className={cn(
            "mt-3 aspect-video overflow-hidden rounded-xl",
            className,
          )}
        >
          <iframe
            title={frameTitle}
            src={src}
            loading="lazy"
            allow={ALLOW.youtube}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="block size-full border-0"
          />
        </div>
      );
    }

    // Apple shows a tall card for an album, a compact bar for a single song.
    const appleAlbum = provider === "apple" && music.id.split("/").length < 3;
    const height =
      provider === "spotify"
        ? 152
        : provider === "soundcloud"
          ? 166
          : appleAlbum
            ? 450
            : 175;

    return (
      <div
        data-export-exclude
        className={cn("mt-3 overflow-hidden rounded-xl", className)}
      >
        <iframe
          title={frameTitle}
          src={src}
          width="100%"
          height={height}
          loading="lazy"
          allow={ALLOW[provider]}
          className="block w-full rounded-xl border-0"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      data-export-exclude
      onClick={() => setLoaded(true)}
      aria-label={title ? `Play ${title} on ${label}` : `Play song on ${label}`}
      className={cn(
        "mt-3 flex w-full items-center gap-3 rounded-xl border bg-muted/40 p-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {thumbnail ? (
        // biome-ignore lint/performance/noImgElement: platform CDN cover, display-only; intentionally not run through Vercel image optimization
        <img
          src={thumbnail}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          decoding="async"
          className="size-12 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-md"
          style={{ backgroundColor: accent }}
        >
          <PlayIcon className="size-5 fill-white text-white" />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-sm">
          {title || `${label} track`}
        </span>
        <span className="text-muted-foreground text-xs">
          Tap to play on {label}
        </span>
      </span>

      <span
        className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: accent }}
      >
        <PlayIcon className="size-4 fill-white text-white" />
      </span>
    </button>
  );
}

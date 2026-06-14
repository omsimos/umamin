"use client";

import { cn } from "@umamin/ui/lib/utils";
import { PlayIcon } from "lucide-react";
import { useState } from "react";
import { spotifyEmbedUrl } from "@/lib/spotify";

type Props = {
  trackId: string;
  title?: string | null;
  thumbnail?: string | null;
  className?: string;
};

const SPOTIFY_GREEN = "#1db954";

// Lazy by design: the feed renders many notes, so we never mount a Spotify
// iframe until the listener taps the facade — one tap, one player, no wall of
// third-party frames. The whole element carries data-export-exclude so the
// saved-note image omits the song (a cross-origin iframe can't be captured, and
// the song is intentionally left out of saves — see saveImage).
export function NoteSpotifyEmbed({
  trackId,
  title,
  thumbnail,
  className,
}: Props) {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <div
        data-export-exclude
        className={cn("mt-3 overflow-hidden rounded-xl", className)}
      >
        <iframe
          title={title ? `Spotify: ${title}` : "Spotify player"}
          src={spotifyEmbedUrl(trackId)}
          width="100%"
          height={152}
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
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
      aria-label={title ? `Play ${title} on Spotify` : "Play song on Spotify"}
      className={cn(
        "mt-3 flex w-full items-center gap-3 rounded-xl border bg-muted/40 p-2.5 text-left transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {thumbnail ? (
        // biome-ignore lint/performance/noImgElement: Spotify CDN cover, display-only; intentionally not run through Vercel image optimization
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
          style={{ backgroundColor: SPOTIFY_GREEN }}
        >
          <PlayIcon className="size-5 fill-black text-black" />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-sm">
          {title || "Spotify track"}
        </span>
        <span className="text-muted-foreground text-xs">
          Tap to play on Spotify
        </span>
      </span>

      <span
        className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: SPOTIFY_GREEN }}
      >
        <PlayIcon className="size-4 fill-black text-black" />
      </span>
    </button>
  );
}

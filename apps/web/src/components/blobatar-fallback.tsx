import { AvatarFallback } from "@umamin/ui/components/avatar";
import { blobatarUri } from "blobatar/uri";
import { ScanFaceIcon } from "lucide-react";
import { useMemo } from "react";

/**
 * The default profile picture: a deterministic blobatar for whoever the avatar
 * belongs to, shown whenever they have no uploaded photo (and while one loads).
 *
 * Seeded on the user ID rather than the username, because usernames are
 * editable in Settings — keying on the handle would hand someone a different
 * creature for renaming themselves. Both author projections carry `id`, so it
 * is available on every surface.
 *
 * `seed` is nullable on purpose and falls back to the generic icon: a deleted
 * or anonymous notification actor has nothing to derive a creature from. That
 * nullability is also the anonymity guard — a creature seeded on anonymous
 * content is a deanonymization vector, since the same one beside a real handle
 * elsewhere links the two. It holds because `getNotesPage` drops the author
 * from an anonymous note server-side, so there is no id to leak in the first
 * place; the anonymous branches keep the generic icon.
 *
 * Rendered inline as a `data:` URI rather than fetched from a route: an avatar
 * per feed row would be 20 extra requests, where the markup is ~735 bytes that
 * gzip well against each other. Transparent backdrop by default, so the
 * fallback's own `bg-muted` shows through and follows the theme — blobatar's
 * built-in backgrounds are a fixed near-white.
 */
export function BlobatarFallback({
  seed,
  className,
}: {
  seed?: string | null;
  className?: string;
}) {
  const src = useMemo(() => (seed ? blobatarUri(seed) : null), [seed]);

  return (
    <AvatarFallback className={className}>
      {src ? (
        // Decorative: <AvatarImage> above carries the alt text, and the avatar
        // usually sits inside an aria-labelled profile link.
        <img src={src} alt="" aria-hidden className="size-full" />
      ) : (
        <ScanFaceIcon />
      )}
    </AvatarFallback>
  );
}

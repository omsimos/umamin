import { cn } from "@umamin/ui/lib/utils";

export function OrgAvatar({
  displayName,
  username,
  imageUrl,
  size = 40,
  className,
}: {
  displayName: string | null;
  username: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (
    displayName?.trim()?.[0] ??
    username[0] ??
    "?"
  ).toUpperCase();

  if (imageUrl) {
    // crossOrigin so the avatar can be rasterized into exported images.
    return (
      // biome-ignore lint/performance/noImgElement: rasterized by modern-screenshot; next/image can't be captured
      <img
        src={imageUrl}
        alt=""
        crossOrigin="anonymous"
        style={{ width: size, height: size }}
        className={cn("rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: Math.round(size / 2.4) }}
      className={cn(
        "bg-primary/10 text-primary flex items-center justify-center rounded-full font-semibold",
        className,
      )}
    >
      {initial}
    </div>
  );
}

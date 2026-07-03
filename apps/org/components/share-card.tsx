import { formatDistanceToNow } from "date-fns";
import type { ExportTheme } from "@/lib/export-themes";
import type { OrgMessageItem } from "@/lib/query-types";

// The classes below resolve through the shadcn CSS variables, so a theme is
// just inline overrides of those variables — inline style beats the
// :root/.dark values and the markup stays a faithful copy of www's card.
function themeVars(theme: ExportTheme): React.CSSProperties {
  return {
    "--card": theme.card,
    "--card-foreground": theme.cardForeground,
    "--muted": theme.muted,
    "--muted-foreground": theme.mutedForeground,
    "--border": theme.border,
    color: theme.cardForeground,
  } as React.CSSProperties;
}

// Mirrors apps/www's received-message card — the exact markup its saveImage
// captures — so org exports look identical to core-app exports. Rendered
// off-screen for rasterization (lib/export.tsx) and live in the theme dialog
// preview, which is what guarantees the preview matches the export.
export function ShareCard({
  message,
  theme,
}: {
  message: OrgMessageItem;
  theme?: ExportTheme;
}) {
  return (
    <div
      className="min-w-2 w-full bg-card p-6 rounded-xl border"
      style={theme ? themeVars(theme) : undefined}
    >
      <p className="font-bold text-center leading-normal text-lg min-w-0 break-words mb-4">
        {message.question}
      </p>
      <div className="flex w-full flex-col gap-2 rounded-lg p-5 whitespace-pre-wrap bg-muted break-words min-w-0">
        {message.content}
      </div>
      <p className="text-muted-foreground text-sm mt-4 italic text-center">
        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
      </p>
    </div>
  );
}

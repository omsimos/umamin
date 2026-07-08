"use client";

import { Button } from "@umamin/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@umamin/ui/components/dialog";
import { Label } from "@umamin/ui/components/label";
import { cn } from "@umamin/ui/lib/utils";
import { CheckIcon, PaletteIcon } from "lucide-react";
import { useState } from "react";
import {
  type CustomColors,
  EXPORT_THEME_PRESETS,
  type ExportThemePrefs,
  resolveExportTheme,
  saveExportThemePrefs,
  seedForPrefs,
} from "@/lib/export-themes";
import type { OrgMessageItem } from "@/lib/query-types";
import { ShareCard } from "./share-card";

const FALLBACK_SAMPLE: OrgMessageItem = {
  id: "sample",
  question: "Send us an anonymous message!",
  content: "We love what you're building — keep it up!",
  createdAt: 0,
};

const CUSTOM_FIELDS: Array<{ key: keyof CustomColors; label: string }> = [
  { key: "canvas", label: "Background" },
  { key: "card", label: "Card" },
  { key: "box", label: "Content box" },
  { key: "text", label: "Text" },
];

export function ExportThemeDialog({
  prefs,
  onSave,
  sample,
}: {
  prefs: ExportThemePrefs;
  onSave: (prefs: ExportThemePrefs) => void;
  sample: OrgMessageItem | null;
}) {
  const [open, setOpen] = useState(false);
  // Working copy — committed only on Save.
  const [draft, setDraft] = useState<ExportThemePrefs>(prefs);

  const theme = resolveExportTheme(draft);
  const seed = seedForPrefs(draft);
  const message = sample ?? {
    ...FALLBACK_SAMPLE,
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
  };

  function openChange(next: boolean) {
    setOpen(next);
    if (next) setDraft(prefs); // re-sync when reopened after outside changes
  }

  function pickCustomColor(key: keyof CustomColors, value: string) {
    setDraft({ mode: "custom", custom: { ...seed, [key]: value } });
  }

  function save() {
    saveExportThemePrefs(draft);
    onSave(draft);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={openChange}>
      <DialogTrigger asChild>
        <Button variant="outline" aria-label="Export theme">
          <PaletteIcon />
          <span className="hidden sm:inline">Theme</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90dvh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export theme</DialogTitle>
          <DialogDescription>
            Choose how downloaded message images look. The preview matches the
            export exactly.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable middle so the footer stays pinned regardless of preview length. */}
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto py-1 sm:grid-cols-[1fr_minmax(0,20rem)]">
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_THEME_PRESETS.map((preset) => {
                const active =
                  draft.mode === "preset" && draft.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setDraft({ mode: "preset", presetId: preset.id })
                    }
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border p-2.5 text-left text-sm transition-colors",
                      active
                        ? "border-primary ring-primary/40 ring-2"
                        : "hover:bg-accent/50",
                    )}
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-md border"
                      style={{ background: preset.seed.canvas }}
                    >
                      <span
                        className="flex size-5 items-center justify-center rounded-sm text-[9px] font-bold"
                        style={{
                          background: preset.seed.card,
                          color: preset.seed.text,
                        }}
                      >
                        Aa
                      </span>
                    </span>
                    <span className="flex-1 truncate">{preset.label}</span>
                    {active && <CheckIcon className="text-primary size-4" />}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3">
              <p
                className={cn(
                  "text-sm font-medium",
                  draft.mode === "custom" && "text-primary",
                )}
              >
                Custom colors{draft.mode === "custom" && " (active)"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CUSTOM_FIELDS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="color"
                      id={`theme-${key}`}
                      value={seed[key]}
                      onChange={(e) => pickCustomColor(key, e.target.value)}
                      className="size-8 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                    />
                    <Label
                      htmlFor={`theme-${key}`}
                      className="text-muted-foreground text-xs"
                    >
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                Picking a color starts from the selected preset.
              </p>
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              Preview
            </p>
            {/* Bounded + self-scrolling so a long message can't blow up the
                dialog. Watermark is omitted here — it's stamped at export. */}
            <div
              className="max-h-[46dvh] overflow-y-auto rounded-xl border p-4"
              style={{ background: theme.canvas }}
            >
              <ShareCard message={message} theme={theme} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save theme</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

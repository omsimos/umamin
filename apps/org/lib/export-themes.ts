// Color themes for exported message images. Pure module (client + tests).
//
// A theme is a set of shadcn CSS-variable overrides applied inline on the
// ShareCard root (inline style beats the :root/.dark class values), plus the
// canvas color used by the export pipeline for the padded background.

export type ExportTheme = {
  /** Outer background: domToPng backgroundColor + padForSharing fill. */
  canvas: string;
  /** --card (card background). */
  card: string;
  /** --card-foreground (card text) + wrapper `color`. */
  cardForeground: string;
  /** --muted (content box background). */
  muted: string;
  /** --muted-foreground (timestamp). */
  mutedForeground: string;
  /** --border (card border). */
  border: string;
};

/** The 4 colors orgs pick directly in custom mode; the rest derive. */
export type CustomColors = {
  canvas: string;
  card: string;
  box: string;
  text: string;
};

export type ExportThemePrefs =
  | { mode: "preset"; presetId: string }
  | { mode: "custom"; custom: CustomColors };

export type ExportThemePreset = {
  id: string;
  label: string;
  theme: ExportTheme;
  /** Hex approximations used to seed the custom color pickers. */
  seed: CustomColors;
};

// The default preset snapshots the app's exact dark tokens (globals.css .dark)
// + the #111113 canvas, so default output is pixel-identical to the original
// export look regardless of the org's app color mode.
export const EXPORT_THEME_PRESETS: ExportThemePreset[] = [
  {
    id: "umamin-dark",
    label: "Umamin Dark",
    theme: {
      canvas: "#111113",
      card: "oklch(0.21 0.006 285.885)",
      cardForeground: "oklch(0.985 0 0)",
      muted: "oklch(0.274 0.006 286.033)",
      mutedForeground: "oklch(0.705 0.015 286.067)",
      border: "oklch(1 0 0 / 10%)",
    },
    seed: {
      canvas: "#111113",
      card: "#18181b",
      box: "#27272a",
      text: "#fafafa",
    },
  },
  {
    id: "light",
    label: "Light",
    theme: {
      canvas: "#f4f4f5",
      card: "oklch(1 0 0)",
      cardForeground: "oklch(0.141 0.005 285.823)",
      muted: "oklch(0.967 0.001 286.375)",
      mutedForeground: "oklch(0.552 0.016 285.938)",
      border: "oklch(0.92 0.004 286.32)",
    },
    seed: {
      canvas: "#f4f4f5",
      card: "#ffffff",
      box: "#f4f4f5",
      text: "#18181b",
    },
  },
  {
    id: "rose",
    label: "Rose",
    theme: {
      canvas: "#16040f",
      card: "#2a0a1e",
      cardForeground: "#fdf2f8",
      muted: "#40102d",
      mutedForeground: "#e9a8cd",
      border: "rgba(253, 242, 248, 0.14)",
    },
    seed: {
      canvas: "#16040f",
      card: "#2a0a1e",
      box: "#40102d",
      text: "#fdf2f8",
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    theme: {
      canvas: "#050b16",
      card: "#0c1a2e",
      cardForeground: "#eaf2ff",
      muted: "#14263f",
      mutedForeground: "#9fb8d9",
      border: "rgba(234, 242, 255, 0.14)",
    },
    seed: {
      canvas: "#050b16",
      card: "#0c1a2e",
      box: "#14263f",
      text: "#eaf2ff",
    },
  },
  {
    id: "forest",
    label: "Forest",
    theme: {
      canvas: "#06110b",
      card: "#0d2016",
      cardForeground: "#ecf8f0",
      muted: "#163224",
      mutedForeground: "#a3c9b2",
      border: "rgba(236, 248, 240, 0.14)",
    },
    seed: {
      canvas: "#06110b",
      card: "#0d2016",
      box: "#163224",
      text: "#ecf8f0",
    },
  },
  {
    id: "cream",
    label: "Cream",
    theme: {
      canvas: "#efe7d8",
      card: "#fffdf7",
      cardForeground: "#292315",
      muted: "#f3ecdd",
      mutedForeground: "#857b62",
      border: "#e3d9c4",
    },
    seed: {
      canvas: "#efe7d8",
      card: "#fffdf7",
      box: "#f3ecdd",
      text: "#292315",
    },
  },
];

export const DEFAULT_PRESET_ID = "umamin-dark";

export const DEFAULT_THEME_PREFS: ExportThemePrefs = {
  mode: "preset",
  presetId: DEFAULT_PRESET_ID,
};

function presetById(id: string): ExportThemePreset {
  return (
    EXPORT_THEME_PRESETS.find((p) => p.id === id) ??
    // biome-ignore lint/style/noNonNullAssertion: the default preset is a static registry entry
    EXPORT_THEME_PRESETS.find((p) => p.id === DEFAULT_PRESET_ID)!
  );
}

// Custom mode keeps the picker to 4 safe choices; border and timestamp derive
// from the text color. color-mix resolves in computed styles, so domToPng
// captures the blended value.
export function customToTheme(custom: CustomColors): ExportTheme {
  return {
    canvas: custom.canvas,
    card: custom.card,
    cardForeground: custom.text,
    muted: custom.box,
    mutedForeground: `color-mix(in srgb, ${custom.text} 62%, transparent)`,
    border: `color-mix(in srgb, ${custom.text} 14%, transparent)`,
  };
}

export function resolveExportTheme(prefs: ExportThemePrefs): ExportTheme {
  if (prefs.mode === "custom") return customToTheme(prefs.custom);
  return presetById(prefs.presetId).theme;
}

/** Seed for the custom pickers matching the current prefs. */
export function seedForPrefs(prefs: ExportThemePrefs): CustomColors {
  if (prefs.mode === "custom") return prefs.custom;
  return presetById(prefs.presetId).seed;
}

const STORAGE_KEY = "org-export-theme";

function isCustomColors(value: unknown): value is CustomColors {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.canvas === "string" &&
    typeof v.card === "string" &&
    typeof v.box === "string" &&
    typeof v.text === "string"
  );
}

export function loadExportThemePrefs(): ExportThemePrefs {
  if (typeof window === "undefined") return DEFAULT_THEME_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_THEME_PREFS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return DEFAULT_THEME_PREFS;
    }
    const p = parsed as Record<string, unknown>;
    if (p.mode === "preset" && typeof p.presetId === "string") {
      return { mode: "preset", presetId: p.presetId };
    }
    if (p.mode === "custom" && isCustomColors(p.custom)) {
      return { mode: "custom", custom: p.custom };
    }
    return DEFAULT_THEME_PREFS;
  } catch {
    return DEFAULT_THEME_PREFS;
  }
}

export function saveExportThemePrefs(prefs: ExportThemePrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Storage full/blocked — the choice just won't persist.
  }
}

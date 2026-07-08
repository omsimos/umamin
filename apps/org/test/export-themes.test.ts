import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  customToTheme,
  DEFAULT_PRESET_ID,
  EXPORT_THEME_PRESETS,
  type ExportThemePrefs,
  loadExportThemePrefs,
  resolveExportTheme,
  saveExportThemePrefs,
  seedForPrefs,
} from "@/lib/export-themes";

describe("preset registry", () => {
  it("has unique ids and includes the default", () => {
    const ids = EXPORT_THEME_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_PRESET_ID);
  });

  it("every preset defines all theme + seed fields", () => {
    for (const p of EXPORT_THEME_PRESETS) {
      for (const v of Object.values(p.theme)) {
        expect(typeof v === "string" && v.length > 0).toBe(true);
      }
      for (const v of Object.values(p.seed)) {
        expect(v).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});

describe("resolveExportTheme", () => {
  it("resolves a known preset", () => {
    const theme = resolveExportTheme({ mode: "preset", presetId: "light" });
    expect(theme.canvas).toBe("#f4f4f5");
  });

  it("falls back to the default for an unknown preset id", () => {
    const fallback = resolveExportTheme({
      mode: "preset",
      presetId: "does-not-exist",
    });
    const def = resolveExportTheme({
      mode: "preset",
      presetId: DEFAULT_PRESET_ID,
    });
    expect(fallback).toEqual(def);
  });

  it("expands custom colors and derives border/timestamp via color-mix", () => {
    const theme = customToTheme({
      canvas: "#000000",
      card: "#111111",
      box: "#222222",
      text: "#ffffff",
    });
    expect(theme.canvas).toBe("#000000");
    expect(theme.card).toBe("#111111");
    expect(theme.muted).toBe("#222222");
    expect(theme.cardForeground).toBe("#ffffff");
    expect(theme.border).toContain("color-mix");
    expect(theme.mutedForeground).toContain("#ffffff");
  });
});

describe("seedForPrefs", () => {
  it("returns the preset seed for preset mode", () => {
    expect(seedForPrefs({ mode: "preset", presetId: "light" })).toEqual(
      EXPORT_THEME_PRESETS.find((p) => p.id === "light")?.seed,
    );
  });

  it("returns the custom colors for custom mode", () => {
    const custom = { canvas: "#1", card: "#2", box: "#3", text: "#4" };
    expect(seedForPrefs({ mode: "custom", custom })).toBe(custom);
  });
});

describe("localStorage persistence", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => window.localStorage.clear());

  it("returns the default when nothing is stored", () => {
    expect(loadExportThemePrefs()).toEqual({
      mode: "preset",
      presetId: DEFAULT_PRESET_ID,
    });
  });

  it("returns the default on malformed JSON", () => {
    window.localStorage.setItem("org-export-theme", "{not json");
    expect(loadExportThemePrefs().mode).toBe("preset");
  });

  it("returns the default on a valid-JSON-but-wrong-shape blob", () => {
    window.localStorage.setItem("org-export-theme", JSON.stringify({ x: 1 }));
    expect(loadExportThemePrefs()).toEqual({
      mode: "preset",
      presetId: DEFAULT_PRESET_ID,
    });
  });

  it("round-trips a preset choice", () => {
    const prefs: ExportThemePrefs = { mode: "preset", presetId: "ocean" };
    saveExportThemePrefs(prefs);
    expect(loadExportThemePrefs()).toEqual(prefs);
  });

  it("round-trips custom colors", () => {
    const prefs: ExportThemePrefs = {
      mode: "custom",
      custom: {
        canvas: "#101010",
        card: "#202020",
        box: "#303030",
        text: "#f0f0f0",
      },
    };
    saveExportThemePrefs(prefs);
    expect(loadExportThemePrefs()).toEqual(prefs);
  });
});

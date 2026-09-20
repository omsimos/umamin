import { useTheme } from "next-themes";
import { useEffect } from "react";

// Hex equivalents of --background in @umamin/ui globals.css (oklch(1 0 0) and
// oklch(0.1785 0.0041 285.98)). Must track that file: a mismatch shows as a
// seam between the browser/OS chrome and the page on every mobile screen.
export const THEME_COLOR = { light: "#ffffff", dark: "#111113" } as const;

// Keeps <meta name="theme-color"> (Android status/toolbar tint, the installed
// app's title bar, Safari's tab tint) in step with the resolved theme. The
// pre-paint script in __root.tsx sets the first value; this handles toggles.
export function ThemeColor() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", THEME_COLOR[resolvedTheme]);
  }, [resolvedTheme]);

  return null;
}

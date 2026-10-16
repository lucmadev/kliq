/** Appearance choice stored beside the locale. "system" follows the OS. */

export const THEMES = ["system", "light", "dark"] as const;

export type ThemeChoice = (typeof THEMES)[number];

export function isTheme(value: unknown): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

export const ACCENTS = [
  { id: "blue", light: "#276fc5", dark: "#3987e5", wash: "#e7f0fb", washDark: "#1d2c3d" },
  { id: "teal", light: "#0d7972", dark: "#2bb8ad", wash: "#e4f6f4", washDark: "#163330" },
  { id: "violet", light: "#6d5bd0", dark: "#8b7ae8", wash: "#eeeafb", washDark: "#262043" },
  { id: "rose", light: "#bc4266", dark: "#e56b8c", wash: "#fbeaf0", washDark: "#3a2230" },
  { id: "amber", light: "#976500", dark: "#e0a100", wash: "#fbf3e0", washDark: "#3a2e14" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];

export const DEFAULT_ACCENT: AccentId = "blue";

export function isAccent(value: unknown): value is AccentId {
  return ACCENTS.some((accent) => accent.id === value);
}

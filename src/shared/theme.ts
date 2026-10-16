/** Appearance choice stored beside the locale. "system" follows the OS. */

export const THEMES = ["system", "light", "dark"] as const;

export type ThemeChoice = (typeof THEMES)[number];

export function isTheme(value: unknown): value is ThemeChoice {
  return value === "system" || value === "light" || value === "dark";
}

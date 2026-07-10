import type { TextStyle, ViewStyle } from "react-native";

/**
 * JanSetu mobile design system — Material Design 3 (Google's current
 * styling spec, m3.material.io), hand-rolled as typed tokens so no extra
 * runtime dependency is needed. The tonal palette is seeded from setu blue
 * (#1B4F8A) via the Material theme-builder mapping; the web app mirrors the
 * same brand tokens in apps/web/app/globals.css.
 *
 * Legacy keys (petrol, paper, card, line, ink, muted…) are aliases onto the
 * M3 scheme so every existing screen restyles without edits. New code
 * should prefer the M3 names.
 */

/* ── M3 colour scheme (light), seed #1B4F8A ─────────────────────────────── */

export const m3 = {
  primary: "#1B4F8A",
  onPrimary: "#FFFFFF",
  primaryContainer: "#D4E3FF",
  onPrimaryContainer: "#001C3A",

  secondary: "#545F71",
  onSecondary: "#FFFFFF",
  secondaryContainer: "#D8E3F8",
  onSecondaryContainer: "#111C2B",

  tertiary: "#8A5100", // amber tonal role — civic accents
  onTertiary: "#FFFFFF",
  tertiaryContainer: "#FFDCBB",
  onTertiaryContainer: "#2C1600",

  error: "#BA1A1A",
  onError: "#FFFFFF",
  errorContainer: "#FFDAD6",
  onErrorContainer: "#410002",

  surface: "#F8F9FC",
  onSurface: "#191C20",
  surfaceVariant: "#E0E2EC",
  onSurfaceVariant: "#44474E",
  surfaceContainerLowest: "#FFFFFF",
  surfaceContainerLow: "#F2F3F9",
  surfaceContainer: "#ECEEF4",
  surfaceContainerHigh: "#E6E8EE",

  outline: "#74777F",
  outlineVariant: "#C4C6CF",

  inverseSurface: "#2E3035",
  inverseOnSurface: "#F0F0F7",
  inversePrimary: "#A6C8FF",
} as const;

/* ── M3 shape scale ──────────────────────────────────────────────────────── */

export const shape = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 28,
  full: 999,
} as const;

/* ── M3 type scale (Roboto/system; sizes per m3.material.io/styles) ─────── */

const t = (
  fontSize: number,
  lineHeight: number,
  fontWeight: TextStyle["fontWeight"],
  letterSpacing = 0,
): TextStyle => ({ fontSize, lineHeight, fontWeight, letterSpacing });

export const type = {
  displaySmall: t(36, 44, "400"),
  headlineMedium: t(28, 36, "400"),
  headlineSmall: t(24, 32, "400"),
  titleLarge: t(22, 28, "500"),
  titleMedium: t(16, 24, "600", 0.15),
  titleSmall: t(14, 20, "600", 0.1),
  bodyLarge: t(16, 24, "400", 0.15),
  bodyMedium: t(14, 20, "400", 0.25),
  bodySmall: t(12, 16, "400", 0.4),
  labelLarge: t(14, 20, "600", 0.1),
  labelMedium: t(12, 16, "600", 0.5),
  labelSmall: t(11, 16, "600", 0.5),
} as const;

/* ── M3 elevation (RN shadow approximations of levels 1–3) ──────────────── */

export const elevation: Record<1 | 2 | 3, ViewStyle> = {
  1: {
    shadowColor: "#101E35",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  2: {
    shadowColor: "#101E35",
    shadowOpacity: 0.11,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  3: {
    shadowColor: "#101E35",
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
};

/* ── Legacy aliases (existing screens use these; do not remove) ─────────── */

export const colors = {
  brand: m3.primary,
  brandDeep: "#123A66",
  petrol: m3.primary,
  petrolDeep: "#123A66",
  amber: "#E8A13D",
  ink: m3.onSurface,
  muted: m3.onSurfaceVariant,
  paper: m3.surface,
  card: m3.surfaceContainerLowest,
  line: m3.outlineVariant,
  good: "#2E8B57",
  warn: "#D97E2B",
  bad: "#C0442E",
  nodata: "#9DAEBC",
  geoBg: "#E2F1E8",
  geoText: "#1F6B42",
} as const;

export function verdictColor(verdict: "good" | "mixed" | "poor" | null) {
  if (verdict === "good") return colors.good;
  if (verdict === "mixed") return colors.warn;
  if (verdict === "poor") return colors.bad;
  return colors.nodata;
}

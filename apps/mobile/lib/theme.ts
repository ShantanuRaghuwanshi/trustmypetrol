/**
 * JanSetu brand tokens. `petrol` is the legacy key used across the app — it
 * now carries the setu-blue brand colour (one swap recolours everything);
 * prefer `brand` in new code. Mirrors :root in apps/web/app/globals.css.
 */
export const colors = {
  brand: "#1B4F8A",
  brandDeep: "#123A66",
  petrol: "#1B4F8A",
  petrolDeep: "#123A66",
  amber: "#E8A13D",
  ink: "#212A2C",
  muted: "#7B8A8C",
  paper: "#F6F8F7",
  card: "#FFFFFF",
  line: "#E3E9E8",
  good: "#2E8B57",
  warn: "#D97E2B",
  bad: "#C0442E",
  nodata: "#9DB0AE",
  geoBg: "#E2F1E8",
  geoText: "#1F6B42",
} as const;

export function verdictColor(verdict: "good" | "mixed" | "poor" | null) {
  if (verdict === "good") return colors.good;
  if (verdict === "mixed") return colors.warn;
  if (verdict === "poor") return colors.bad;
  return colors.nodata;
}

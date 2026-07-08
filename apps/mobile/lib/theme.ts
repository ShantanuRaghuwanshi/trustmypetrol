export const colors = {
  petrol: "#0E6B72",
  petrolDeep: "#0A4E54",
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

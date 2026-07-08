/**
 * The fixed signal vocabulary. Reports select from these — never free-form
 * accusations. This is the defamation firewall: score maths only ever sees
 * counts of observable signals.
 */
export const SIGNALS = {
  mileage_drop: {
    label: "Mileage drop",
    hint: "Noticeable km/l drop after filling here",
    polarity: "negative",
  },
  engine_trouble: {
    label: "Engine trouble",
    hint: "Rough idle, hard start, or stalling after filling",
    polarity: "negative",
  },
  short_fuelling: {
    label: "Short-fuelling",
    hint: "Dispensed quantity looked short vs. the display",
    polarity: "negative",
  },
  meter_issue: {
    label: "Meter issue",
    hint: "Meter not zeroed before filling, or jumped",
    polarity: "negative",
  },
  density_check_refused: {
    label: "Density check refused",
    hint: "Staff refused the density / 5-litre measure test",
    polarity: "negative",
  },
  no_e20_labelling: {
    label: "No E20 labelling",
    hint: "Blend labelling missing or unclear on dispensers",
    polarity: "negative",
  },
  overcharge: {
    label: "Overcharged",
    hint: "Charged above the displayed board price",
    polarity: "negative",
  },
  good_experience: {
    label: "Good experience",
    hint: "Correct quantity, labelled blend, no issues",
    polarity: "positive",
  },
  blend_update: {
    label: "Blend update",
    hint: "Pump now stocks / stopped stocking a blend",
    polarity: "neutral",
  },
} as const;

export type Signal = keyof typeof SIGNALS;
export type SignalPolarity = (typeof SIGNALS)[Signal]["polarity"];

export const ALL_SIGNALS = Object.keys(SIGNALS) as Signal[];

export const NEGATIVE_SIGNALS = ALL_SIGNALS.filter(
  (s) => SIGNALS[s].polarity === "negative",
);

export function isNegativeReport(signals: readonly Signal[]): boolean {
  return signals.some((s) => SIGNALS[s].polarity === "negative");
}

/** Signals that count toward scoring at all (blend_update is informational). */
export function isScorableReport(signals: readonly Signal[]): boolean {
  return signals.some((s) => SIGNALS[s].polarity !== "neutral");
}

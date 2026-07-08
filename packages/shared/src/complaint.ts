import { SIGNALS, type Signal } from "./signals";
import type { Pump, Report } from "./types";

export const COMPLAINT_CHANNELS = [
  {
    id: "cpgrams" as const,
    label: "CPGRAMS (pgportal.gov.in)",
    url: "https://pgportal.gov.in/",
    note: "Routes to Ministry of Petroleum & Natural Gas · 30-day resolution target",
  },
  {
    id: "omc_portal" as const,
    label: "OMC portal",
    note: "Direct to the oil company that licenses this pump",
    urlByOmc: {
      IOCL: "https://cx.indianoil.in/",
      BPCL: "https://www.bharatpetroleum.in/contact-us.aspx",
      HPCL: "https://www.hindustanpetroleum.com/pages/Complaints-and-Feedback",
    } as Record<string, string>,
  },
];

/**
 * Pumps imported from OpenStreetMap carry an OSM-<id> placeholder until
 * enriched with real OMC dealer codes — never show those as official.
 */
export function displayDealerCode(dealerCode: string): string | null {
  return dealerCode.startsWith("OSM-") ? null : dealerCode;
}

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/**
 * Draft grievance text the user copies into CPGRAMS / an OMC portal.
 * We prepare; the citizen files.
 */
export function draftGrievance(pump: Pump, report: Report): string {
  const when = new Date(report.reportedAt).toLocaleString("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  const observed = report.signals
    .filter((s): s is Signal => s in SIGNALS && s !== "good_experience")
    .map((s) => SIGNALS[s].label.toLowerCase())
    .join("; ");

  const purchase =
    report.litres && report.amountInr
      ? ` I purchased ${report.litres} L of petrol (${INR.format(report.amountInr)}).`
      : "";

  const evidence =
    report.verification === "geo_verified"
      ? ` Geo-tagged photographic evidence is attached — capture location verified within ${Math.round(report.distanceToPumpM ?? 0)} m of the outlet.`
      : " Photographic evidence is attached.";

  const code = displayDealerCode(pump.dealerCode);
  const dealerLine = code
    ? ` (${pump.omc} dealer code ${code})`
    : ` (${pump.omc === "OTHER" ? "retail outlet" : `${pump.omc} outlet`})`;

  return (
    `Complaint regarding fuel quality / dispensing at ${pump.name}, ` +
    `${pump.address}, ${pump.district}, ${pump.state}${dealerLine}.\n\n` +
    `On ${when} I visited this retail outlet.${purchase} ` +
    `Issues observed: ${observed}.${evidence}\n\n` +
    `I request that a fuel quality and quantity inspection of this outlet be ` +
    `conducted under the Motor Spirit and High Speed Diesel (Regulation of ` +
    `Supply, Distribution and Prevention of Malpractices) Order, 2005, and ` +
    `that action be taken as per the Marketing Discipline Guidelines.`
  );
}

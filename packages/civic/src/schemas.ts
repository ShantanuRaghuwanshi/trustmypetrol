import { z } from "zod";
import { ALL_ISSUE_TYPES, ISSUE_SEVERITIES } from "./issues";

export const issueTypeSchema = z.enum(
  ALL_ISSUE_TYPES as [string, ...string[]],
);

export const issueSeveritySchema = z.enum(
  ISSUE_SEVERITIES as unknown as [string, ...string[]],
);

/**
 * Client payload for submitting a civic report. Unlike pump reports the
 * capture is mandatory — the location *is* the subject of the report.
 * The server (submit_civic_report) derives verification, jurisdiction, and
 * issue clustering itself; clients can never self-verify or pick an agency.
 */
export const createCivicReportSchema = z.object({
  issueType: issueTypeSchema,
  kind: z.enum(["report", "resolved_confirmation"]).default("report"),
  description: z.string().trim().max(500).optional(),
  severity: issueSeveritySchema.optional(),
  capture: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyM: z.number().nonnegative().max(10_000),
    capturedAt: z.string().datetime(),
    mockLocation: z.boolean(),
  }),
});

export type CreateCivicReportInput = z.infer<typeof createCivicReportSchema>;

/** Client payload for drafting a complaint against an issue. */
export const createCivicComplaintSchema = z.object({
  issueId: z.string().uuid(),
  reportId: z.string().uuid().optional(),
  channel: z.enum(["agency_portal", "state_portal", "cpgrams"]),
  /** Present when escalating an earlier complaint up the ladder. */
  escalatedFrom: z.string().uuid().optional(),
});

export type CreateCivicComplaintInput = z.infer<
  typeof createCivicComplaintSchema
>;

/** Registration numbers vary by portal; same envelope as fuel complaints. */
export const trackCivicComplaintSchema = z.object({
  complaintId: z.string().uuid(),
  referenceNo: z
    .string()
    .trim()
    .min(4)
    .max(40)
    .regex(/^[A-Za-z0-9/\-]+$/, "Registration numbers are alphanumeric"),
});

export type TrackCivicComplaintInput = z.infer<
  typeof trackCivicComplaintSchema
>;

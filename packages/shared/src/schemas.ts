import { z } from "zod";
import { ALL_SIGNALS } from "./signals";

export const signalSchema = z.enum(
  ALL_SIGNALS as [string, ...string[]],
);

/** Client payload for creating a report. Server derives verification itself. */
export const createReportSchema = z.object({
  pumpId: z.string().uuid(),
  signals: z.array(signalSchema).min(1).max(6),
  freeText: z.string().trim().max(500).optional(),
  odoKm: z.number().int().positive().max(2_000_000).optional(),
  litres: z.number().positive().max(500).optional(),
  amountInr: z.number().positive().max(100_000).optional(),
  capture: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      accuracyM: z.number().nonnegative(),
      capturedAt: z.string().datetime(),
      mockLocation: z.boolean(),
    })
    .optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const complaintDraftSchema = z.object({
  pumpId: z.string().uuid(),
  reportId: z.string().uuid().optional(),
  channel: z.enum(["cpgrams", "omc_portal", "other"]),
});

export const trackComplaintSchema = z.object({
  complaintId: z.string().uuid(),
  referenceNo: z
    .string()
    .trim()
    .min(4)
    .max(40)
    .regex(/^[A-Za-z0-9/\-]+$/, "Registration numbers are alphanumeric"),
});

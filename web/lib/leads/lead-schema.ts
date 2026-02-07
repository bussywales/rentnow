import { z } from "zod";
import { LEAD_FINANCING, LEAD_INTENTS, LEAD_TIMELINES, LEAD_STATUSES } from "@/lib/leads/types";

const toNumberOrNull = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

export const leadCreateSchema = z.object({
  property_id: z.string().uuid(),
  intent: z.enum(LEAD_INTENTS).optional().default("BUY"),
  budget_min: z.preprocess(toNumberOrNull, z.number().nonnegative().nullable().optional()),
  budget_max: z.preprocess(toNumberOrNull, z.number().nonnegative().nullable().optional()),
  financing_status: z.enum(LEAD_FINANCING).optional().nullable(),
  timeline: z.enum(LEAD_TIMELINES).optional().nullable(),
  message: z.string().min(10).max(1500),
  consent: z.boolean().optional(),
  source: z.enum(["agent_client_page", "unknown"]).optional(),
  clientPageId: z.string().optional().nullable(),
});

export const leadStatusUpdateSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  clientPageId: z.string().optional().nullable(),
});

export type LeadCreateInput = z.infer<typeof leadCreateSchema>;
export type LeadStatusUpdateInput = z.infer<typeof leadStatusUpdateSchema>;

export function buildLeadSystemMessage(message: string) {
  return `New buy enquiry submitted.\n\n${message}`;
}

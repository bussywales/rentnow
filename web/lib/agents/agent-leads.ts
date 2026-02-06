import { z } from "zod";

export const agentLeadPayloadSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(40).optional().nullable(),
  message: z.string().min(10).max(1500),
  company: z.string().max(120).optional().nullable(),
});

export type AgentLeadPayload = z.infer<typeof agentLeadPayloadSchema>;

export function isHoneypotTriggered(payload: AgentLeadPayload) {
  return !!payload.company && payload.company.trim().length > 0;
}

export function getRateLimitWindowStart(now: Date, windowMinutes: number) {
  return new Date(now.getTime() - windowMinutes * 60 * 1000).toISOString();
}

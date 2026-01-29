import { z } from "zod";

export const adminSavedViewSchema = z.object({
  name: z.string().min(1),
  route: z.string().min(1),
  query: z.record(z.string(), z.unknown()).optional(),
  query_json: z.record(z.string(), z.unknown()).optional(),
});

export type AdminSavedViewPayload = z.infer<typeof adminSavedViewSchema>;

export function normalizeSavedViewPayload(payload: AdminSavedViewPayload) {
  return {
    name: payload.name.trim(),
    route: payload.route,
    query_json: payload.query_json ?? payload.query ?? {},
  };
}

export type AuditEvent =
  | "availability.rules.upsert"
  | "availability.exceptions.create"
  | "availability.exceptions.delete"
  | "availability.seed_default";

type AuditContext = {
  route: string;
  actorId?: string;
  propertyId?: string;
  outcome: "ok" | "deny" | "error";
  reason?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export function logAuditEvent(event: AuditEvent, ctx: AuditContext): void {
  const payload = {
    event,
    route: ctx.route,
    actorId: ctx.actorId,
    propertyId: ctx.propertyId,
    outcome: ctx.outcome,
    reason: ctx.reason,
    meta: ctx.meta,
    at: new Date().toISOString(),
  };
  // Safe JSON line; no sensitive data.
  console.info(JSON.stringify(payload));
}

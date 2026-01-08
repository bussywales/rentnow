export type ShareAccessResult =
  | "ok"
  | "invalid"
  | "expired"
  | "revoked"
  | "unauthenticated"
  | "forbidden";

type ShareAccessInput = {
  result: ShareAccessResult;
  shareId?: string | null;
  propertyId?: string | null;
  tenantId?: string | null;
  actorProfileId?: string | null;
  userAgent?: string | null;
};

const MAX_UA_LENGTH = 160;

export function buildShareAccessLog(
  input: ShareAccessInput,
  now = new Date()
) {
  const ua = input.userAgent?.trim();
  return {
    event: "share_access_attempt",
    result: input.result,
    share_id: input.shareId ?? undefined,
    property_id: input.propertyId ?? undefined,
    tenant_id: input.tenantId ?? undefined,
    actor_profile_id: input.actorProfileId ?? undefined,
    ua: ua ? ua.slice(0, MAX_UA_LENGTH) : undefined,
    ts: now.toISOString(),
  };
}

export function logShareAccess(
  input: ShareAccessInput,
  logger: (line: string) => void = (line) => console.info(line)
) {
  const payload = buildShareAccessLog(input);
  logger(JSON.stringify(payload));
  return payload;
}

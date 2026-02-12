export function formatIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function buildAdminReferralAttributionContextUrl(input: {
  referrerUserId: string;
  requestedAt?: string | null;
}): string {
  const params = new URLSearchParams();
  const referrer = String(input.referrerUserId || "").trim();
  if (referrer) {
    params.set("referrer", referrer);
  }

  const requestedAt = String(input.requestedAt || "").trim();
  const parsed = requestedAt ? new Date(requestedAt) : null;
  if (parsed && Number.isFinite(parsed.getTime())) {
    const from = new Date(parsed);
    from.setUTCDate(from.getUTCDate() - 14);
    const to = new Date(parsed);
    to.setUTCDate(to.getUTCDate() + 1);
    params.set("from", formatIsoDateOnly(from));
    params.set("to", formatIsoDateOnly(to));
  }

  const query = params.toString();
  return `/admin/referrals/attribution${query ? `?${query}` : ""}`;
}


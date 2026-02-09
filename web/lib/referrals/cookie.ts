const REFERRAL_COOKIE_NAME = "ph_referral_code";

function parseCookieHeader(header: string): Array<{ name: string; value: string }> {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return { name: part, value: "" };
      return {
        name: decodeURIComponent(part.slice(0, idx).trim()),
        value: decodeURIComponent(part.slice(idx + 1).trim()),
      };
    });
}

export function readReferralCodeFromCookieHeader(header: string | null): string | null {
  if (!header) return null;
  const match = parseCookieHeader(header).find((cookie) => cookie.name === REFERRAL_COOKIE_NAME);
  if (!match?.value) return null;
  const normalized = match.value.trim().toUpperCase();
  return normalized || null;
}

export function getReferralCookieName() {
  return REFERRAL_COOKIE_NAME;
}

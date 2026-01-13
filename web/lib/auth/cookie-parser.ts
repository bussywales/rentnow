import { parseSupabaseAuthCookieValue } from "@/lib/auth/admin-session";

type CookiePair = { name: string; value: string };

function parseCookieHeader(header: string): CookiePair[] {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return { name: part, value: "" };
      return { name: part.slice(0, idx), value: part.slice(idx + 1) };
    });
}

export function selectAuthCookieValueFromHeader(
  header: string | null,
  cookieName: string
): string | undefined {
  if (!header) return undefined;

  const cookies = parseCookieHeader(header);
  const matches = cookies.filter((cookie) => cookie.name === cookieName);
  if (matches.length === 0) return undefined;

  for (const match of matches) {
    const session = parseSupabaseAuthCookieValue(match.value);
    if (session) {
      const normalized = `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`;
      return normalized;
    }
  }

  return undefined;
}

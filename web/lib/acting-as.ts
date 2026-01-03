import type { NextRequest } from "next/server";

const ACTING_AS_COOKIE = "rentnow_acting_as";
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readActingAsFromRequest(request: NextRequest): string | null {
  const { searchParams } = new URL(request.url);
  const param = searchParams.get("actingAs");
  const cookieValue = request.cookies.get(ACTING_AS_COOKIE)?.value;
  const candidate = param || cookieValue || null;
  if (!candidate) return null;
  return uuidRegex.test(candidate) ? candidate : null;
}

export function getActingAsCookieName() {
  return ACTING_AS_COOKIE;
}

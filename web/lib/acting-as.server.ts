import { cookies } from "next/headers";

const ACTING_AS_COOKIE = "rentnow_acting_as";
const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readActingAsFromCookies(): Promise<string | null> {
  const store = cookies();
  const cookieStore = store instanceof Promise ? await store : store;
  const cookieValue = cookieStore.get(ACTING_AS_COOKIE)?.value ?? null;
  if (!cookieValue) return null;
  return uuidRegex.test(cookieValue) ? cookieValue : null;
}

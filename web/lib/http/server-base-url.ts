import { headers } from "next/headers";

export async function getServerBaseUrl() {
  const hdrs = await headers();
  const proto = hdrs.get("x-forwarded-proto") || "https";
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
  return host ? `${proto}://${host}` : "";
}

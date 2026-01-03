import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getFlutterwaveConfig } from "@/lib/billing/flutterwave";

const routeLabel = "/api/billing/flutterwave/initialize";

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "tenant"],
  });
  if (!auth.ok) return auth.response;

  const { flutterwaveMode } = await getProviderModes();
  const config = await getFlutterwaveConfig(flutterwaveMode);

  return NextResponse.json(
    {
      ok: false,
      code: "not_implemented",
      mode: config.mode,
      providerKeyPresent: config.keyPresent,
    },
    { status: 501 }
  );
}

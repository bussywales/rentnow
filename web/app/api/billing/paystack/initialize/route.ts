import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { getProviderModes } from "@/lib/billing/provider-settings";
import { getPaystackConfig } from "@/lib/billing/paystack";

const routeLabel = "/api/billing/paystack/initialize";

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "tenant"],
  });
  if (!auth.ok) return auth.response;

  const { paystackMode } = await getProviderModes();
  const config = await getPaystackConfig(paystackMode);

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

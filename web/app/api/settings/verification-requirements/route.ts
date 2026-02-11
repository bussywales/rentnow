import { NextResponse } from "next/server";
import { getVerificationRequirements } from "@/lib/settings/app-settings.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const requirements = await getVerificationRequirements();
  return NextResponse.json(
    { ok: true, requirements },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { POST as respondPost } from "../respond/route";

export const dynamic = "force-dynamic";

const declinePayloadSchema = z.object({
  reason: z.string().trim().max(280).optional(),
});

function buildRespondUrl(inputUrl: string): URL {
  const url = new URL(inputUrl);
  url.pathname = url.pathname.replace(/\/decline$/, "/respond");
  return url;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const parsed = declinePayloadSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 422 });
  }

  const reason = parsed.data.reason?.trim();
  const forwardRequest = new NextRequest(buildRespondUrl(request.url), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({
      action: "decline",
      ...(reason ? { reason } : {}),
    }),
  });

  return respondPost(forwardRequest, context);
}

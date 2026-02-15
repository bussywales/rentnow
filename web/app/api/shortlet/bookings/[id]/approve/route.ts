import { NextRequest } from "next/server";
import { POST as respondPost } from "../respond/route";

export const dynamic = "force-dynamic";

function buildRespondUrl(inputUrl: string): URL {
  const url = new URL(inputUrl);
  url.pathname = url.pathname.replace(/\/approve$/, "/respond");
  return url;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const forwardRequest = new NextRequest(buildRespondUrl(request.url), {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify({ action: "accept" }),
  });

  return respondPost(forwardRequest, context);
}

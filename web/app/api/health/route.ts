import { NextResponse } from "next/server";

const PUBLIC_SERVICE_NAME = "propatyhub-web";

export function getPublicHealthResponse() {
  return NextResponse.json({
    ok: true,
    service: PUBLIC_SERVICE_NAME,
  });
}

export async function GET() {
  return getPublicHealthResponse();
}

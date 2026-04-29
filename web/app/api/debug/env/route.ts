import { NextResponse } from "next/server";

export function getDeprecatedDebugEnvResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "Gone",
    },
    { status: 410 }
  );
}

export async function GET() {
  return getDeprecatedDebugEnvResponse();
}

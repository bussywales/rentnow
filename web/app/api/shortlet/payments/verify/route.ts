import { NextResponse } from "next/server";

const routeLabel = "/api/shortlet/payments/verify";

function notImplementedResponse() {
  return NextResponse.json(
    {
      error: "Not implemented",
      route: routeLabel,
    },
    { status: 501 }
  );
}

export async function GET() {
  return notImplementedResponse();
}

export async function POST() {
  return notImplementedResponse();
}


import { NextResponse } from "next/server";
import { z } from "zod";
import { logClientRuntimeError, logFailure } from "@/lib/observability";

export const dynamic = "force-dynamic";

const routeLabel = "/api/client-errors";

const clientErrorSchema = z.object({
  digest: z.string().trim().min(1).max(120).optional(),
  message: z.string().trim().min(1).max(4_000),
  stack: z.string().trim().max(20_000).optional(),
  pathname: z.string().trim().max(2_000).optional(),
  href: z.string().trim().max(4_000).optional(),
  userAgent: z.string().trim().max(1_000).optional(),
});

export async function postClientErrorReportResponse(request: Request) {
  const startTime = Date.now();

  try {
    const parsed = clientErrorSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const payload = parsed.data;
    logClientRuntimeError({
      request,
      route: routeLabel,
      reportedRoute: payload.pathname || null,
      digest: payload.digest || null,
      message: payload.message,
      stack: payload.stack || null,
      href: payload.href || null,
      pathname: payload.pathname || null,
      userAgent: payload.userAgent || null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Unable to record client error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return postClientErrorReportResponse(request);
}

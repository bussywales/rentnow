import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import {
  createGuestCompletedStayReview,
  getBookingReviewState,
  respondToCompletedStayReview,
} from "@/lib/shortlet/reviews.server";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/shortlet/bookings/[id]/review";

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(20).max(600),
});

const respondSchema = z.object({
  response: z.string().trim().min(8).max(500),
});

type RouteContext = { params: Promise<{ id: string }> };

async function resolveClient() {
  if (hasServiceRoleEnv()) return createServiceRoleClient();
  return createServerSupabaseClient();
}

export async function GET(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const client = await resolveClient();
  const state = await getBookingReviewState({
    client,
    bookingId: id,
    viewerUserId: auth.user.id,
  });

  if (!state || state.viewer === "other") {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json({
    bookingId: state.bookingId,
    bookingStatus: state.bookingStatus,
    canLeaveReview: state.canLeaveReview,
    canRespond: state.canRespond,
    review: state.review,
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = createReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review payload" }, { status: 400 });
  }

  const client = await resolveClient();
  const result = await createGuestCompletedStayReview({
    client,
    bookingId: id,
    guestUserId: auth.user.id,
    rating: parsed.data.rating,
    body: parsed.data.body,
  });

  if (!result.ok) {
    const status =
      result.error === "booking_not_found"
        ? 404
        : result.error === "review_not_allowed"
          ? 403
          : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ review: result.review }, { status: 201 });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const startTime = Date.now();
  if (!hasServerSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const auth = await requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = respondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review response payload" }, { status: 400 });
  }

  try {
    const client = await resolveClient();
    const result = await respondToCompletedStayReview({
      client,
      bookingId: id,
      hostUserId: auth.user.id,
      response: parsed.data.response,
    });

    if (!result.ok) {
      const status =
        result.error === "review_not_found"
          ? 404
          : result.error === "response_not_allowed"
            ? 403
            : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ review: result.review });
  } catch (error) {
    logFailure({
      request,
      route: routeLabel,
      status: 500,
      startTime,
      error,
    });
    return NextResponse.json({ error: "Unable to update review" }, { status: 500 });
  }
}

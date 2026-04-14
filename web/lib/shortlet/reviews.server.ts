import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeRole } from "@/lib/roles";
import {
  SHORTLET_PUBLIC_REVIEW_DIRECTION,
  buildHostReviewSummary,
  canGuestLeaveCompletedStayReview,
  clampReviewRating,
  formatStayMonth,
  type HostReviewSummary,
  type PublicShortletStayReview,
} from "@/lib/shortlet/reviews";

export type BookingReviewViewer = "guest" | "host" | "other";
export type AdminReviewResponseFilter = "all" | "responded" | "pending_response";
export type AdminReviewRatingFilter = "all" | "low";

export type BookingReviewState = {
  bookingId: string;
  propertyId: string;
  hostUserId: string;
  guestUserId: string;
  bookingStatus: string;
  viewer: BookingReviewViewer;
  canLeaveReview: boolean;
  canRespond: boolean;
  review: PublicShortletStayReview | null;
};

export type HostReviewOpsSummary = HostReviewSummary & {
  awaitingResponseCount: number;
};

export type AdminCompletedStayReview = PublicShortletStayReview & {
  reviewerUserId: string;
  revieweeUserId: string;
  reviewerRole: string;
  revieweeRole: string;
  guestUserId: string | null;
  guestName: string | null;
  hostName: string | null;
  propertyCity: string | null;
  checkIn: string | null;
  checkOut: string | null;
  bookingContextHref: string;
  propertyHref: string;
  publicProfileHref: string;
};

type ReviewRow = {
  id: string;
  booking_id: string;
  property_id: string;
  reviewer_user_id?: string;
  reviewee_user_id: string;
  reviewer_role?: string;
  reviewee_role?: string;
  rating: number;
  body: string;
  public_response: string | null;
  public_response_updated_at: string | null;
  created_at: string;
  shortlet_bookings?: {
    host_user_id?: string | null;
    guest_user_id?: string | null;
    check_in?: string | null;
    check_out?: string | null;
    properties?: { id?: string | null; title?: string | null; city?: string | null } | null;
  } | null;
};

type BookingContextRow = {
  id: string;
  property_id: string;
  guest_user_id: string;
  host_user_id: string;
  status: string;
};

function mapReviewRow(row: ReviewRow): PublicShortletStayReview {
  return {
    id: row.id,
    bookingId: row.booking_id,
    propertyId: row.property_id,
    hostUserId: row.reviewee_user_id,
    rating: row.rating,
    body: row.body,
    createdAt: row.created_at,
    stayDateLabel: formatStayMonth(row.shortlet_bookings?.check_out ?? null),
    propertyTitle: row.shortlet_bookings?.properties?.title ?? null,
    publicResponse: row.public_response ?? null,
    publicResponseUpdatedAt: row.public_response_updated_at ?? null,
  };
}

function formatProfileName(profile: {
  display_name?: string | null;
  full_name?: string | null;
  business_name?: string | null;
} | null | undefined) {
  return profile?.display_name || profile?.full_name || profile?.business_name || null;
}

export async function getBookingReviewState(input: {
  client: SupabaseClient;
  bookingId: string;
  viewerUserId: string;
}): Promise<BookingReviewState | null> {
  const { data: bookingData, error: bookingError } = await input.client
    .from("shortlet_bookings")
    .select("id, property_id, guest_user_id, host_user_id, status")
    .eq("id", input.bookingId)
    .maybeSingle();

  if (bookingError || !bookingData) return null;

  const booking = bookingData as BookingContextRow;
  const { data: reviewData } = await input.client
    .from("shortlet_booking_reviews")
    .select(
      "id, booking_id, property_id, reviewee_user_id, rating, body, public_response, public_response_updated_at, created_at, shortlet_bookings!inner(host_user_id, check_out, properties(title))"
    )
    .eq("booking_id", input.bookingId)
    .eq("direction", SHORTLET_PUBLIC_REVIEW_DIRECTION)
    .maybeSingle();

  const review = reviewData ? mapReviewRow(reviewData as ReviewRow) : null;
  const viewer: BookingReviewViewer =
    input.viewerUserId === booking.guest_user_id
      ? "guest"
      : input.viewerUserId === booking.host_user_id
        ? "host"
        : "other";

  return {
    bookingId: booking.id,
    propertyId: booking.property_id,
    hostUserId: booking.host_user_id,
    guestUserId: booking.guest_user_id,
    bookingStatus: booking.status,
    viewer,
    canLeaveReview: canGuestLeaveCompletedStayReview({
      bookingStatus: booking.status,
      viewerIsGuest: viewer === "guest",
      existingReviewId: review?.id ?? null,
    }),
    canRespond: viewer === "host" && !!review,
    review,
  };
}

export async function createGuestCompletedStayReview(input: {
  client: SupabaseClient;
  bookingId: string;
  guestUserId: string;
  rating: number;
  body: string;
}) {
  const normalizedRating = clampReviewRating(input.rating);
  if (!normalizedRating) {
    return { ok: false as const, error: "invalid_rating" };
  }

  const state = await getBookingReviewState({
    client: input.client,
    bookingId: input.bookingId,
    viewerUserId: input.guestUserId,
  });

  if (!state) return { ok: false as const, error: "booking_not_found" };
  if (!state.canLeaveReview) return { ok: false as const, error: "review_not_allowed" };

  const { data: hostProfile } = await input.client
    .from("profiles")
    .select("role")
    .eq("id", state.hostUserId)
    .maybeSingle();
  const revieweeRole = normalizeRole(hostProfile?.role ?? null) === "agent" ? "agent" : "landlord";

  const { data, error } = await input.client
    .from("shortlet_booking_reviews")
    .insert({
      booking_id: state.bookingId,
      property_id: state.propertyId,
      reviewer_user_id: state.guestUserId,
      reviewee_user_id: state.hostUserId,
      reviewer_role: "tenant",
      reviewee_role: revieweeRole,
      direction: SHORTLET_PUBLIC_REVIEW_DIRECTION,
      rating: normalizedRating,
      body: input.body.trim(),
      visibility: "public",
      moderation_status: "published",
      published_at: new Date().toISOString(),
    })
    .select(
      "id, booking_id, property_id, reviewee_user_id, rating, body, public_response, public_response_updated_at, created_at, shortlet_bookings!inner(host_user_id, check_out, properties(title))"
    )
    .single();

  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "review_insert_failed" };
  }

  return { ok: true as const, review: mapReviewRow(data as ReviewRow) };
}

export async function respondToCompletedStayReview(input: {
  client: SupabaseClient;
  bookingId: string;
  hostUserId: string;
  response: string;
}) {
  const state = await getBookingReviewState({
    client: input.client,
    bookingId: input.bookingId,
    viewerUserId: input.hostUserId,
  });

  if (!state?.review) return { ok: false as const, error: "review_not_found" };
  if (!state.canRespond) return { ok: false as const, error: "response_not_allowed" };

  const { data, error } = await input.client
    .from("shortlet_booking_reviews")
    .update({
      public_response: input.response.trim(),
      public_response_updated_at: new Date().toISOString(),
    })
    .eq("id", state.review.id)
    .select(
      "id, booking_id, property_id, reviewee_user_id, rating, body, public_response, public_response_updated_at, created_at, shortlet_bookings!inner(host_user_id, check_out, properties(title))"
    )
    .single();

  if (error || !data) {
    return { ok: false as const, error: error?.message ?? "review_response_failed" };
  }

  return { ok: true as const, review: mapReviewRow(data as ReviewRow) };
}

export async function listPublicHostReviews(input: {
  client: SupabaseClient;
  hostUserId: string;
  propertyId?: string | null;
  limit?: number;
}) {
  const limit = Math.max(1, Math.min(12, Math.trunc(input.limit ?? 4)));
  let query = input.client
    .from("shortlet_booking_reviews")
    .select(
      "id, booking_id, property_id, reviewee_user_id, rating, body, public_response, public_response_updated_at, created_at, shortlet_bookings!inner(host_user_id, check_out, properties(title))"
    )
    .eq("direction", SHORTLET_PUBLIC_REVIEW_DIRECTION)
    .eq("visibility", "public")
    .eq("moderation_status", "published")
    .eq("reviewee_user_id", input.hostUserId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.propertyId) {
    query = query.eq("property_id", input.propertyId);
  }

  const { data, error } = await query;
  if (error) return { reviews: [] as PublicShortletStayReview[], error: error.message };

  return {
    reviews: ((data as ReviewRow[] | null) ?? []).map(mapReviewRow),
    error: null,
  };
}

export async function getPublicHostReviewSummaryByHostIds(input: {
  client: SupabaseClient;
  hostUserIds: string[];
}) {
  const uniqueHostIds = Array.from(new Set(input.hostUserIds.filter(Boolean)));
  if (!uniqueHostIds.length) return {} as Record<string, HostReviewSummary>;

  const { data, error } = await input.client
    .from("shortlet_booking_reviews")
    .select(
      "id, booking_id, property_id, reviewee_user_id, rating, body, public_response, public_response_updated_at, created_at, shortlet_bookings!inner(host_user_id, check_out, properties(title))"
    )
    .eq("direction", SHORTLET_PUBLIC_REVIEW_DIRECTION)
    .eq("visibility", "public")
    .eq("moderation_status", "published")
    .in("reviewee_user_id", uniqueHostIds);

  if (error || !data) return {} as Record<string, HostReviewSummary>;

  const grouped = new Map<string, PublicShortletStayReview[]>();
  for (const row of (data as ReviewRow[])) {
    const mapped = mapReviewRow(row);
    if (!grouped.has(mapped.hostUserId)) {
      grouped.set(mapped.hostUserId, []);
    }
    grouped.get(mapped.hostUserId)!.push(mapped);
  }

  return uniqueHostIds.reduce<Record<string, HostReviewSummary>>((acc, hostUserId) => {
    acc[hostUserId] = buildHostReviewSummary(grouped.get(hostUserId) ?? []);
    return acc;
  }, {});
}

export async function getHostReviewOpsSummaryByHostIds(input: {
  client: SupabaseClient;
  hostUserIds: string[];
}) {
  const uniqueHostIds = Array.from(new Set(input.hostUserIds.filter(Boolean)));
  if (!uniqueHostIds.length) return {} as Record<string, HostReviewOpsSummary>;

  const { data, error } = await input.client
    .from("shortlet_booking_reviews")
    .select(
      "id, booking_id, property_id, reviewee_user_id, rating, body, public_response, public_response_updated_at, created_at, shortlet_bookings!inner(host_user_id, check_out, properties(title))"
    )
    .eq("direction", SHORTLET_PUBLIC_REVIEW_DIRECTION)
    .eq("visibility", "public")
    .eq("moderation_status", "published")
    .in("reviewee_user_id", uniqueHostIds);

  if (error || !data) return {} as Record<string, HostReviewOpsSummary>;

  const grouped = new Map<string, ReviewRow[]>();
  for (const row of data as ReviewRow[]) {
    const hostUserId = row.reviewee_user_id;
    if (!grouped.has(hostUserId)) grouped.set(hostUserId, []);
    grouped.get(hostUserId)!.push(row);
  }

  return uniqueHostIds.reduce<Record<string, HostReviewOpsSummary>>((acc, hostUserId) => {
    const rows = grouped.get(hostUserId) ?? [];
    const reviews = rows.map(mapReviewRow);
    acc[hostUserId] = {
      ...buildHostReviewSummary(reviews),
      awaitingResponseCount: rows.filter((row) => !String(row.public_response ?? "").trim()).length,
    };
    return acc;
  }, {});
}

export async function listAdminCompletedStayReviews(input: {
  client: SupabaseClient;
  limit?: number;
  response?: AdminReviewResponseFilter;
  rating?: AdminReviewRatingFilter;
  from?: string | null;
}) {
  const limit = Math.max(1, Math.min(200, Math.trunc(input.limit ?? 100)));
  let query = input.client
    .from("shortlet_booking_reviews")
    .select(
      "id, booking_id, property_id, reviewer_user_id, reviewee_user_id, reviewer_role, reviewee_role, rating, body, public_response, public_response_updated_at, created_at, shortlet_bookings!inner(host_user_id, guest_user_id, check_in, check_out, properties(id, title, city))"
    )
    .eq("direction", SHORTLET_PUBLIC_REVIEW_DIRECTION)
    .eq("visibility", "public")
    .eq("moderation_status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.response === "responded") {
    query = query.not("public_response", "is", null);
  } else if (input.response === "pending_response") {
    query = query.is("public_response", null);
  }

  if (input.rating === "low") {
    query = query.lte("rating", 3);
  }

  if (input.from) {
    query = query.gte("created_at", input.from);
  }

  const { data, error } = await query;
  if (error || !data) {
    return {
      reviews: [] as AdminCompletedStayReview[],
      summary: {
        totalReviews: 0,
        averageRating: null as number | null,
        lowRatingCount: 0,
        awaitingResponseCount: 0,
      },
      error: error?.message ?? null,
    };
  }

  const rows = data as ReviewRow[];
  const profileIds = Array.from(
    new Set(
      rows.flatMap((row) => [row.reviewer_user_id, row.reviewee_user_id]).filter((value): value is string => !!value)
    )
  );

  const { data: profileRows } = profileIds.length
    ? await input.client
        .from("profiles")
        .select("id, full_name, display_name, business_name, public_slug")
        .in("id", profileIds)
    : { data: [] };

  const profileMap = new Map(
    ((profileRows as Array<{
      id: string;
      full_name?: string | null;
      display_name?: string | null;
      business_name?: string | null;
      public_slug?: string | null;
    }> | null) ?? []).map((profile) => [profile.id, profile])
  );

  const reviews = rows.map<AdminCompletedStayReview>((row) => {
    const base = mapReviewRow(row);
    const reviewerProfile = row.reviewer_user_id ? profileMap.get(row.reviewer_user_id) : null;
    const revieweeProfile = profileMap.get(row.reviewee_user_id);
    const revieweeSlug = revieweeProfile?.public_slug?.trim() || null;
    const revieweeRole = normalizeRole(row.reviewee_role ?? null);

    return {
      ...base,
      reviewerUserId: row.reviewer_user_id ?? "",
      revieweeUserId: row.reviewee_user_id,
      reviewerRole: row.reviewer_role ?? "tenant",
      revieweeRole: row.reviewee_role ?? "landlord",
      guestUserId: row.shortlet_bookings?.guest_user_id ?? null,
      guestName: formatProfileName(reviewerProfile),
      hostName: formatProfileName(revieweeProfile),
      propertyCity: row.shortlet_bookings?.properties?.city ?? null,
      checkIn: row.shortlet_bookings?.check_in ?? null,
      checkOut: row.shortlet_bookings?.check_out ?? null,
      bookingContextHref: `/admin/shortlets?q=${encodeURIComponent(row.booking_id)}`,
      propertyHref: `/properties/${row.property_id}`,
      publicProfileHref:
        revieweeRole === "agent" && revieweeSlug
          ? `/agents/${encodeURIComponent(revieweeSlug)}`
          : `/u/${encodeURIComponent(row.reviewee_user_id)}`,
    };
  });

  return {
    reviews,
    summary: {
      totalReviews: reviews.length,
      averageRating: buildHostReviewSummary(reviews).averageRating,
      lowRatingCount: reviews.filter((review) => review.rating <= 3).length,
      awaitingResponseCount: reviews.filter((review) => !review.publicResponse?.trim()).length,
    },
    error: null,
  };
}

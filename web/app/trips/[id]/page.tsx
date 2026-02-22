import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TripCoordinationPanel } from "@/components/trips/TripCoordinationPanel";
import { TripTimeline } from "@/components/trips/TripTimeline";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { resolveGuestCheckinVisibility } from "@/lib/shortlet/checkin-visibility";
import { normalizeShortletPaymentStatus } from "@/lib/shortlet/return-status";
import { resolveTripTimelineSteps } from "@/lib/shortlet/trip-timeline";
import {
  getGuestShortletCheckinDetailsForBooking,
  getGuestShortletBookingById,
  getLatestShortletPaymentStatusForBooking,
} from "@/lib/shortlet/shortlet.server";

export const dynamic = "force-dynamic";

function formatMoney(currency: string, amountMinor: number): string {
  const amount = Math.max(0, Math.trunc(amountMinor || 0)) / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const [hourText, minuteText = "00"] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function resolveSnapshotAmount(snapshot: Record<string, unknown>, key: string): number | null {
  const value = snapshot[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function statusTone(status: string) {
  if (status === "confirmed" || status === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }
  if (status === "pending_payment") {
    return "border-sky-200 bg-sky-50 text-sky-800";
  }
  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }
  if (status === "cancelled" || status === "declined" || status === "expired") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect(`/auth/required?redirect=/trips/${id}&reason=auth`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "tenant") {
    redirect("/forbidden?reason=role");
  }

  const client = hasServiceRoleEnv() ? createServiceRoleClient() : supabase;
  const booking = await getGuestShortletBookingById({
    client,
    guestUserId: user.id,
    bookingId: id,
  }).catch(() => null);

  if (!booking) notFound();

  const snapshot =
    booking.pricing_snapshot_json && typeof booking.pricing_snapshot_json === "object"
      ? booking.pricing_snapshot_json
      : {};
  const bookingMode = snapshot.booking_mode === "instant" ? "instant" : "request";
  const paymentStatus = await getLatestShortletPaymentStatusForBooking({
    client,
    bookingId: booking.id,
  }).catch(() => null);
  const normalizedPaymentStatus = normalizeShortletPaymentStatus(paymentStatus);

  const timeline = resolveTripTimelineSteps({
    bookingStatus: booking.status,
    paymentStatus: normalizedPaymentStatus,
    bookingMode,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
  });

  const nightlyMinor = resolveSnapshotAmount(snapshot, "nightly_price_minor");
  const nights = resolveSnapshotAmount(snapshot, "nights") ?? booking.nights;
  const subtotalMinor = resolveSnapshotAmount(snapshot, "subtotal_minor");
  const cleaningMinor = resolveSnapshotAmount(snapshot, "cleaning_fee_minor");
  const depositMinor = resolveSnapshotAmount(snapshot, "deposit_minor");
  const totalMinor =
    resolveSnapshotAmount(snapshot, "total_amount_minor") ?? booking.total_amount_minor;

  const isPendingPayment = booking.status === "pending_payment";
  const isConfirmed = booking.status === "confirmed" || booking.status === "completed";
  const checkinVisibility = resolveGuestCheckinVisibility({
    bookingStatus: booking.status,
    paymentStatus: normalizedPaymentStatus,
  });
  const checkinDetails = await getGuestShortletCheckinDetailsForBooking({
    client,
    bookingId: booking.id,
    guestUserId: user.id,
    visibilityLevel: checkinVisibility.level,
  }).catch(() => null);
  const petsAllowed = checkinDetails?.pets_allowed ?? null;
  const smokingAllowed = checkinDetails?.smoking_allowed ?? null;
  const partiesAllowed = checkinDetails?.parties_allowed ?? null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
      <TripTimeline
        timeline={timeline}
        listingHref={`/properties/${booking.property_id}`}
        respondByIso={booking.expires_at}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Trip</p>
            <h1 className="text-2xl font-semibold text-slate-900">{booking.property_title || "Shortlet booking"}</h1>
            <p className="text-sm text-slate-600">{booking.city || "Unknown city"}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(booking.status)}`}>
            {booking.status}
          </span>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {timeline.helperBody}
        </div>

        <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-900">Check-in:</span> {formatDate(booking.check_in)}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Check-out:</span> {formatDate(booking.check_out)}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Nights:</span> {booking.nights}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Created:</span> {formatDate(booking.created_at)}
          </p>
        </div>

        {isConfirmed ? (
          <div className="mt-4 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Price breakdown</p>
            <div className="mt-2 space-y-1">
              {nightlyMinor !== null ? (
                <p>
                  Nightly: {formatMoney(booking.currency, nightlyMinor)} x {nights}
                </p>
              ) : null}
              {subtotalMinor !== null ? <p>Subtotal: {formatMoney(booking.currency, subtotalMinor)}</p> : null}
              {cleaningMinor !== null ? <p>Cleaning fee: {formatMoney(booking.currency, cleaningMinor)}</p> : null}
              {depositMinor !== null ? <p>Deposit: {formatMoney(booking.currency, depositMinor)}</p> : null}
              <p className="font-semibold text-slate-900">Total: {formatMoney(booking.currency, totalMinor)}</p>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {isPendingPayment ? (
            <Link
              href={`/payments/shortlet/checkout?bookingId=${booking.id}`}
              className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Continue payment
            </Link>
          ) : null}
          <Link
            href={`/properties/${booking.property_id}`}
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            View listing
          </Link>
          <Link
            href="/trips"
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to trips
          </Link>
          <Link
            href="/help"
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Need help?
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="trip-checkin-details">
        <h2 className="text-lg font-semibold text-slate-900">Check-in details</h2>
        {!checkinVisibility.canShow ? (
          <p className="mt-2 text-sm text-slate-600">
            Check-in details and house rules will be shared after payment is confirmed.
          </p>
        ) : checkinVisibility.level === "limited" ? (
          <p className="mt-2 text-sm text-slate-600">
            Your payment is confirmed. Full arrival instructions are shared once the host approves your request.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Your booking is confirmed. Use these arrival details for a smooth check-in.
          </p>
        )}

        {checkinVisibility.canShow ? (
          <div className="mt-4 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <p>
              <span className="font-semibold text-slate-900">Check-in window:</span>{" "}
              {checkinDetails?.checkin_window_start || checkinDetails?.checkin_window_end
                ? `${formatTime(checkinDetails?.checkin_window_start)} - ${formatTime(checkinDetails?.checkin_window_end)}`
                : "Flexible"}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Checkout time:</span>{" "}
              {formatTime(checkinDetails?.checkout_time)}
            </p>
            {checkinVisibility.level === "full" && checkinDetails?.access_method ? (
              <p>
                <span className="font-semibold text-slate-900">Access:</span> {checkinDetails.access_method}
              </p>
            ) : null}
            {checkinVisibility.level === "full" && checkinDetails?.access_code_hint ? (
              <p>
                <span className="font-semibold text-slate-900">Access hint:</span> {checkinDetails.access_code_hint}
              </p>
            ) : null}
            {checkinVisibility.level === "full" && checkinDetails?.parking_info ? (
              <p className="sm:col-span-2">
                <span className="font-semibold text-slate-900">Parking:</span> {checkinDetails.parking_info}
              </p>
            ) : null}
            {checkinVisibility.level === "full" && checkinDetails?.wifi_info ? (
              <p className="sm:col-span-2">
                <span className="font-semibold text-slate-900">Wi-Fi:</span> {checkinDetails.wifi_info}
              </p>
            ) : null}
            {checkinVisibility.level === "full" && checkinDetails?.checkin_instructions ? (
              <p className="sm:col-span-2">
                <span className="font-semibold text-slate-900">Arrival instructions:</span>{" "}
                {checkinDetails.checkin_instructions}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">House rules</p>
          {checkinVisibility.canShow ? (
            <div className="mt-2 space-y-1">
              {checkinDetails?.house_rules ? <p>{checkinDetails.house_rules}</p> : <p>Follow the listing and host guidance during your stay.</p>}
              <p>
                <span className="font-semibold text-slate-900">Quiet hours:</span>{" "}
                {checkinDetails?.quiet_hours_start || checkinDetails?.quiet_hours_end
                  ? `${formatTime(checkinDetails?.quiet_hours_start)} - ${formatTime(checkinDetails?.quiet_hours_end)}`
                  : "Not specified"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Pets:</span>{" "}
                {petsAllowed === null
                  ? "Not specified"
                  : petsAllowed
                    ? "Allowed"
                    : "Not allowed"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Smoking:</span>{" "}
                {smokingAllowed === null
                  ? "Not specified"
                  : smokingAllowed
                    ? "Allowed"
                    : "Not allowed"}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Parties:</span>{" "}
                {partiesAllowed === null
                  ? "Not specified"
                  : partiesAllowed
                    ? "Allowed"
                    : "Not allowed"}
              </p>
              {checkinDetails?.max_guests_override ? (
                <p>
                  <span className="font-semibold text-slate-900">Max guests:</span>{" "}
                  {checkinDetails.max_guests_override}
                </p>
              ) : null}
              {checkinVisibility.level === "full" && checkinDetails?.emergency_notes ? (
                <p>
                  <span className="font-semibold text-slate-900">Emergency notes:</span>{" "}
                  {checkinDetails.emergency_notes}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2">House rules will appear after payment succeeds.</p>
          )}
        </div>
      </section>

      <TripCoordinationPanel
        bookingId={booking.id}
        bookingStatus={booking.status}
        propertyId={booking.property_id}
      />
    </div>
  );
}

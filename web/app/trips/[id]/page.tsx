import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { getGuestShortletBookingById } from "@/lib/shortlet/shortlet.server";

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

  const nightlyMinor = resolveSnapshotAmount(snapshot, "nightly_price_minor");
  const nights = resolveSnapshotAmount(snapshot, "nights") ?? booking.nights;
  const subtotalMinor = resolveSnapshotAmount(snapshot, "subtotal_minor");
  const cleaningMinor = resolveSnapshotAmount(snapshot, "cleaning_fee_minor");
  const depositMinor = resolveSnapshotAmount(snapshot, "deposit_minor");
  const totalMinor =
    resolveSnapshotAmount(snapshot, "total_amount_minor") ?? booking.total_amount_minor;

  const isPendingPayment = booking.status === "pending_payment";
  const isPending = booking.status === "pending";
  const isConfirmed = booking.status === "confirmed" || booking.status === "completed";
  const isClosed = booking.status === "cancelled" || booking.status === "declined" || booking.status === "expired";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
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
          {isPendingPayment ? "Payment is required to continue this booking." : null}
          {isPending ? "Waiting for host to respond." : null}
          {isConfirmed ? "Your booking is confirmed." : null}
          {isClosed ? "This booking is closed. You can browse new shortlet dates anytime." : null}
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
        </div>
      </section>
    </div>
  );
}

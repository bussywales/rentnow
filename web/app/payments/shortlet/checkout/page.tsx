import Link from "next/link";
import { redirect } from "next/navigation";
import { ShortletPaymentChoiceCard } from "@/components/payments/ShortletPaymentChoiceCard";
import { getServerAuthUser } from "@/lib/auth/server-session";
import {
  getShortletPaymentCheckoutContext,
  getShortletPaymentsProviderFlags,
  isNigeriaShortlet,
} from "@/lib/shortlet/payments.server";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readBookingId(params: Record<string, string | string[] | undefined>) {
  const fromCamel = params.bookingId;
  const fromSnake = params.booking_id;
  const first = Array.isArray(fromCamel) ? fromCamel[0] : fromCamel;
  const fallback = Array.isArray(fromSnake) ? fromSnake[0] : fromSnake;
  return String(first || fallback || "").trim();
}

function formatMoney(currency: string, amountMinor: number) {
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

export default async function ShortletPaymentCheckoutPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const bookingId = readBookingId(params);

  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    const redirectTarget = bookingId
      ? `/payments/shortlet/checkout?bookingId=${encodeURIComponent(bookingId)}`
      : "/payments/shortlet/checkout";
    redirect(`/auth/required?redirect=${encodeURIComponent(redirectTarget)}&reason=auth`);
  }

  if (!bookingId) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Missing booking reference.
        </div>
      </div>
    );
  }

  const booking = await getShortletPaymentCheckoutContext({
    bookingId,
    guestUserId: user.id,
    client: hasServiceRoleEnv() ? createServiceRoleClient() : supabase,
  }).catch(() => null);

  if (!booking) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Booking not found.
        </div>
      </div>
    );
  }

  const providers = await getShortletPaymentsProviderFlags();
  const isNigeriaFlow = isNigeriaShortlet(booking) || String(booking.currency || "").toUpperCase() === "NGN";
  const primaryProvider = isNigeriaFlow ? "paystack" : "stripe";
  const paystackEnabled = providers.paystackEnabled;
  const stripeEnabled = providers.stripeEnabled;
  const paystackReason = !paystackEnabled
    ? "Disabled by admin settings."
    : isNigeriaFlow
      ? "Primary for NGN and Nigeria stays."
      : null;
  const stripeReason = !providers.stripeEnabled
    ? "Disabled by admin settings."
    : isNigeriaFlow
      ? "Available as an alternative card checkout."
      : null;

  const totalLabel = formatMoney(booking.currency, booking.totalAmountMinor);
  const isAlreadyPaid =
    booking.payment?.status === "succeeded" ||
    booking.status === "pending" ||
    booking.status === "confirmed" ||
    booking.status === "completed";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Booking summary</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">
          {booking.listingTitle || "Shortlet booking"}
        </h2>
        <p className="text-sm text-slate-600">{booking.city || "Unknown city"}</p>
        <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-900">Dates:</span> {booking.checkIn} to {booking.checkOut}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Nights:</span> {booking.nights}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Total:</span> {totalLabel}
          </p>
          <p>
            <span className="font-semibold text-slate-900">Status:</span> {booking.status}
          </p>
        </div>
      </section>

      {isAlreadyPaid ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
          Payment is already recorded for this booking.
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href={`/trips/${booking.bookingId}`} className="font-semibold underline underline-offset-2">
              Open trip details
            </Link>
            <Link href="/trips" className="font-semibold underline underline-offset-2">
              Back to trips
            </Link>
          </div>
        </section>
      ) : (
        <ShortletPaymentChoiceCard
          bookingId={booking.bookingId}
          primaryProvider={primaryProvider}
          stripe={{ enabled: stripeEnabled, reason: stripeReason }}
          paystack={{ enabled: paystackEnabled, reason: paystackReason }}
        />
      )}
    </div>
  );
}

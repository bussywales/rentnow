import { ShortletPaymentReturnStatus } from "@/components/payments/ShortletPaymentReturnStatus";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readBookingId(params: Record<string, string | string[] | undefined>) {
  const camel = params.bookingId;
  const snake = params.booking_id;
  const fromCamel = Array.isArray(camel) ? camel[0] : camel;
  const fromSnake = Array.isArray(snake) ? snake[0] : snake;
  return String(fromCamel || fromSnake || "").trim();
}

export default async function ShortletPaymentReturnPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const bookingId = readBookingId(params);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      {bookingId ? (
        <ShortletPaymentReturnStatus bookingId={bookingId} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Missing booking reference.
        </div>
      )}
    </div>
  );
}

import { FeaturedPaymentReturnStatus } from "@/components/payments/FeaturedPaymentReturnStatus";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FeaturedPaymentReturnPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawReference = params.reference;
  const reference = Array.isArray(rawReference) ? rawReference[0] : rawReference;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      {reference ? (
        <FeaturedPaymentReturnStatus reference={reference} />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          Missing payment reference.
        </div>
      )}
    </div>
  );
}

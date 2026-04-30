import Link from "next/link";
import { ProductEventTracker } from "@/components/analytics/ProductEventTracker";
import { MoveReadySupplierApplicationForm } from "@/components/services/MoveReadySupplierApplicationForm";

export const dynamic = "force-dynamic";

export default function MoveReadySupplierApplicationPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <ProductEventTracker
        eventName="property_prep_supplier_application_started"
        dedupeKey="property-prep-supplier-application-started"
        properties={{
          role: "supplier",
          pagePath: "/services/providers/apply",
        }}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Property Prep
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">Curated supplier application</h1>
            <p className="mt-2 text-sm text-slate-600">
              PropatyHub reviews suppliers before approving regional/category coverage. This is not a
              public marketplace listing flow.
            </p>
          </div>
          <Link href="/support" className="text-sm font-semibold text-sky-700">
            Contact support
          </Link>
        </div>
      </section>

      <MoveReadySupplierApplicationForm />
    </div>
  );
}

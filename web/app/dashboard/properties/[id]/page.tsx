import Link from "next/link";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { mockProperties } from "@/lib/mock";

type Props = { params: { id: string } };

export default function EditPropertyPage({ params }: Props) {
  const property = mockProperties.find((p) => p.id === params.id);
  if (!property) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Listing not found
          </h1>
          <p className="text-sm text-slate-600">
            This demo listing doesn&apos;t exist. Please pick another from your dashboard.
          </p>
        </div>
        <Link href="/dashboard" className="text-sky-700 font-semibold">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Edit listing
        </h1>
        <p className="text-sm text-slate-600">
          Update details, tweak pricing, or generate fresh AI copy.
        </p>
      </div>
      <PropertyForm initialData={property} />
    </div>
  );
}

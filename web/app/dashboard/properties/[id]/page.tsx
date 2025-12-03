import { notFound } from "next/navigation";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { mockProperties } from "@/lib/mock";

type Props = { params: { id: string } };

export default function EditPropertyPage({ params }: Props) {
  const property = mockProperties.find((p) => p.id === params.id);
  if (!property) return notFound();

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

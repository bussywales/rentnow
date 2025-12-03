import { PropertyForm } from "@/components/properties/PropertyForm";

export const dynamic = "force-dynamic";

export default function NewPropertyPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Create listing</h1>
        <p className="text-sm text-slate-600">
          Add details, upload photos via Supabase Storage, and publish when ready.
        </p>
      </div>
      <PropertyForm />
    </div>
  );
}

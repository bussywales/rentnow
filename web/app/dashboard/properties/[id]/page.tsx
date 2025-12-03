import Link from "next/link";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { mockProperties } from "@/lib/mock";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

async function loadProperty(id: string): Promise<Property | null> {
  const cleanId = decodeURIComponent(id);
  // Short-circuit to mock data for demo IDs
  if (cleanId.startsWith("mock-")) {
    const fromMock = mockProperties.find((p) => p.id === cleanId);
    if (fromMock) return fromMock;
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("properties")
      .select("*, property_images(image_url,id)")
      .eq("id", cleanId)
      .maybeSingle();
    if (!error && data) {
      const typed = data as Property & {
        property_images?: Array<{ id: string; image_url: string }>;
      };
      return {
        ...typed,
        images: typed.property_images?.map((img) => ({
          id: img.id,
          image_url: img.image_url,
        })),
      };
    }
  } catch (err) {
    console.warn("Supabase not configured for dashboard edit; using mock", err);
  }

  const fromMock = mockProperties.find((p) => p.id === cleanId);
  return fromMock || null;
}

export default async function EditPropertyPage({ params }: Props) {
  let property: Property | null = null;
  try {
    property = await loadProperty(params.id);
  } catch (err) {
    console.error("Failed to load property for dashboard edit", err);
    property = null;
  }

  if (!property) {
    const mockLinks = mockProperties.map((p) => (
      <Link key={p.id} href={`/dashboard/properties/${p.id}`} className="text-sky-700">
        {p.title}
      </Link>
    ));
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Listing not found
          </h1>
          <p className="text-sm text-slate-600">
            This listing doesn&apos;t exist. Please pick another from your dashboard.
          </p>
        </div>
        <Link href="/dashboard" className="text-sky-700 font-semibold">
          Back to dashboard
        </Link>
        <div className="space-y-1">
          <p className="text-sm text-slate-700">Demo listings:</p>
          <div className="flex flex-wrap gap-3 text-sm">{mockLinks}</div>
        </div>
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

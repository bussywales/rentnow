import Link from "next/link";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { mockProperties } from "@/lib/mock";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

async function loadProperty(id: string): Promise<Property | null> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("properties")
      .select("*, property_images(image_url,id)")
      .eq("id", id)
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

  const fromMock = mockProperties.find((p) => p.id === id);
  return fromMock || null;
}

export default async function EditPropertyPage({ params }: Props) {
  const property = await loadProperty(params.id);

  if (!property) {
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

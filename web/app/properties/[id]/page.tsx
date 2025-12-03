import Image from "next/image";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { MessageThreadClient } from "@/components/messaging/MessageThreadClient";
import { Button } from "@/components/ui/Button";
import { ViewingRequestForm } from "@/components/viewings/ViewingRequestForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mockProperties } from "@/lib/mock";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

const PropertyMap = dynamic(
  () => import("@/components/properties/PropertyMap"),
  { ssr: false }
);

type Props = { params: { id: string } };

async function getProperty(id: string): Promise<Property | null> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("properties")
      .select("*, property_images(image_url, id)")
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
      } as Property;
    }
  } catch (err) {
    console.warn("Supabase not configured; using mock data", err);
  }

  const fallback = mockProperties.find((p) => p.id === id);
  return fallback || null;
}

export default async function PropertyDetail({ params }: Props) {
  const property = await getProperty(params.id);

  if (!property) return notFound();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4">
      <div className="grid gap-6 md:grid-cols-3">
        <div className="relative h-72 overflow-hidden rounded-2xl md:col-span-2">
          <Image
            src={
              property.images?.[0]?.image_url ||
              "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80"
            }
            alt={property.title}
            fill
            className="object-cover"
            priority
          />
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {property.rental_type === "short_let" ? "Short-let" : "Long-term"}
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {property.title}
          </h1>
          <p className="text-sm text-slate-600">
            {property.city}
            {property.neighbourhood ? ` • ${property.neighbourhood}` : ""}
          </p>
          <div className="text-3xl font-semibold text-slate-900">
            {property.currency} {property.price.toLocaleString()}
            <span className="text-sm font-normal text-slate-500">
              {property.rental_type === "short_let" ? " / night" : " / month"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-700">
            <span>{property.bedrooms} bd</span>
            <span>{property.bathrooms} ba</span>
            {property.furnished && <span>Furnished</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {(property.amenities || []).map((item) => (
              <span
                key={item}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {item}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Button>Contact landlord/agent</Button>
            <Button variant="secondary">Save property</Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">About</h2>
          <p className="text-slate-700 leading-7">{property.description}</p>
          <PropertyMap properties={[property]} height="320px" />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Request a viewing
            </h3>
            <ViewingRequestForm propertyId={property.id} />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">
              Contact landlord/agent
            </h3>
            <MessageThreadClient
              propertyId={property.id}
              recipientId={property.owner_id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

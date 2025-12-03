import Image from "next/image";
import Link from "next/link";
import { MessageThreadClient } from "@/components/messaging/MessageThreadClient";
import { PropertyMapClient } from "@/components/properties/PropertyMapClient";
import { SaveButton } from "@/components/properties/SaveButton";
import { ViewingRequestForm } from "@/components/viewings/ViewingRequestForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mockProperties } from "@/lib/mock";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

async function getProperty(id: string): Promise<Property | null> {
  const cleanId = decodeURIComponent(id);
  // If this is a demo ID, serve from mock data immediately
  if (cleanId.startsWith("mock-")) {
    const fromMock = mockProperties.find((p) => p.id === cleanId);
    if (fromMock) return fromMock;
  }

  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("properties")
      .select("*, property_images(image_url, id)")
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
      } as Property;
    }
  } catch (err) {
    console.warn("Supabase not configured; using mock data", err);
  }

  const fallback = mockProperties.find((p) => p.id === id);
  return fallback || null;
}

export default async function PropertyDetail({ params }: Props) {
  let property: Property | null = null;
  try {
    property = await getProperty(params.id);
  } catch (err) {
    console.error("Failed to load property detail", err);
    property = null;
  }

  if (!property) {
    const mockLinks = mockProperties.map((p) => (
      <Link key={p.id} href={`/properties/${p.id}`} className="text-sky-700">
        {p.title}
      </Link>
    ));
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4">
        <h1 className="text-2xl font-semibold text-slate-900">Listing not found</h1>
        <p className="text-sm text-slate-600">
          This listing isn&apos;t available right now. If you&apos;re running the demo
          without Supabase, please use the mock cards on the Browse page.
        </p>
        <Link href="/properties" className="text-sky-700 font-semibold">
          Back to browse
        </Link>
        <div className="space-y-1">
          <p className="text-sm text-slate-700">Demo listings:</p>
          <div className="flex flex-wrap gap-3 text-sm">{mockLinks}</div>
        </div>
      </div>
    );
  }

  let isSaved = false;
  try {
    const supabase = createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("saved_properties")
        .select("id")
        .eq("user_id", user.id)
        .eq("property_id", property.id)
        .maybeSingle();
      isSaved = !!data;
    }
  } catch {
    isSaved = false;
  }

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
            <span className="flex items-center gap-1">
              <svg
                aria-hidden
                className="h-4 w-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M4 12V7a1 1 0 0 1 1-1h6v6" />
                <path d="M4 21v-3" />
                <path d="M20 21v-3" />
                <path d="M4 15h16v-3a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2Z" />
              </svg>
              {property.bedrooms}
            </span>
            <span className="flex items-center gap-1">
              <svg
                aria-hidden
                className="h-4 w-4 text-slate-500"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M7 4a3 3 0 1 1 6 0v6" />
                <path d="M4 10h14" />
                <path d="M5 20h12" />
                <path d="M5 16h14v2a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2Z" />
                <path d="M15 4h1" />
                <path d="M15 7h2" />
              </svg>
              {property.bathrooms}
            </span>
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
          <SaveButton propertyId={property.id} initialSaved={isSaved} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">About</h2>
          <p className="text-slate-700 leading-7">{property.description}</p>
          <PropertyMapClient properties={[property]} height="320px" />
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

import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PropertyCard } from "@/components/properties/PropertyCard";
import type { Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FavouritesPage() {
  let supabase;
  try {
    supabase = createServerSupabaseClient();
  } catch (err) {
    console.warn("Supabase not configured; favourites fallback", err);
    supabase = null;
  }

  if (!supabase) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Saved properties</h1>
          <p className="text-sm text-slate-600">
            Supabase is not configured; please add env vars to enable favourites.
          </p>
        </div>
      </div>
    );
  }

  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    user = data.user;
  } catch (err) {
    console.error("Failed to fetch user for favourites", err);
  }

  if (!user) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Saved properties</h1>
          <p className="text-sm text-slate-600">
            Log in to save and view your favourites.
          </p>
        </div>
        <Link href="/auth/login" className="text-sky-700 font-semibold">
          Log in
        </Link>
      </div>
    );
  }

  let properties: Property[] = [];
  try {
    const { data, error } = await supabase
      .from("saved_properties")
      .select(
        "property_id, properties(id, owner_id, title, description, city, neighbourhood, address, latitude, longitude, rental_type, price, currency, bedrooms, bathrooms, furnished, amenities, available_from, max_guests, is_approved, is_active, created_at, updated_at, property_images(image_url,id))"
      )
      .eq("user_id", user.id);

    if (error) throw error;

    type SavedRow = { properties?: Property | Property[] | null };
    const rows = (data as SavedRow[]) || [];
    properties =
      rows.flatMap((row) => {
        const prop = Array.isArray(row.properties)
          ? (row.properties[0] as Property | undefined)
          : (row.properties as Property | null);
        return prop ? [prop] : [];
      }) || [];
  } catch (err) {
    console.error("Failed to load favourites", err);
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Saved properties</h1>
          <p className="text-sm text-slate-600">
            We could not load your favourites right now. Please refresh or try again later.
          </p>
        </div>
        <Link href="/properties" className="text-sky-700 font-semibold">
          Browse properties
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Saved properties</h1>
        <p className="text-sm text-slate-600">
          {properties.length ? "Your favourites" : "No favourites yet."}
        </p>
      </div>
      {properties.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              href={`/properties/${property.id}`}
            />
          ))}
        </div>
      ) : (
        <Link href="/properties" className="text-sky-700 font-semibold">
          Browse properties
        </Link>
      )}
    </div>
  );
}

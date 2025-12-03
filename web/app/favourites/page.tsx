import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PropertyCard } from "@/components/properties/PropertyCard";

export const dynamic = "force-dynamic";

export default async function FavouritesPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { data } = await supabase
    .from("saved_properties")
    .select("property_id, properties(*)")
    .eq("user_id", user.id);

  const properties =
    data?.map((row) => {
      const props = row.properties as unknown as { id: string };
      return { ...props, id: row.property_id };
    }) || [];

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

import Link from "next/link";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
import { normalizeRole } from "@/lib/roles";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { orderImagesWithCover } from "@/lib/properties/images";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";
import { fetchSavedPropertyIds } from "@/lib/saved-properties.server";
import type { Property } from "@/lib/types";

const PAGE_SIZE = 12;

type SearchParams = Record<string, string | string[] | undefined>;
type Props = {
  searchParams?: SearchParams | Promise<SearchParams>;
};

function readParam(params: SearchParams, key: string): string | null {
  const value = params[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

function parsePage(params: SearchParams): number {
  const raw = Number(readParam(params, "page"));
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 1;
}

async function resolveSearchParams(input: Props["searchParams"]): Promise<SearchParams> {
  if (!input) return {};
  const maybePromise = input as Promise<SearchParams>;
  if (typeof (maybePromise as { then?: unknown }).then === "function") {
    return maybePromise;
  }
  return input as SearchParams;
}

export const dynamic = "force-dynamic";

export default async function ShortletsPage({ searchParams }: Props) {
  const params = await resolveSearchParams(searchParams);
  const city = readParam(params, "city");
  const page = parsePage(params);

  if (!hasServerSupabaseEnv()) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Shortlet browse is unavailable right now.
        </div>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let role = normalizeRole(null);
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    role = normalizeRole(profile?.role ?? null);
  }

  const includeDemo = includeDemoListingsForViewer({
    viewerRole: role === "admin" ? "admin" : null,
  });

  const nowIso = new Date().toISOString();
  let query = supabase
    .from("properties")
    .select("*, property_images(id,image_url,position,created_at,width,height,bytes,format)", {
      count: "exact",
    })
    .eq("is_approved", true)
    .eq("is_active", true)
    .eq("status", "live")
    .eq("listing_intent", "shortlet")
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
    .order("created_at", { ascending: false });

  if (!includeDemo) {
    query = query.eq("is_demo", false);
  }
  if (city) {
    query = query.ilike("city", `%${city}%`);
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await query.range(from, to);
  const properties = (((data as Array<Property & { property_images?: Array<Record<string, unknown>> }> | null) ?? []).map((row) => ({
    ...row,
        images: orderImagesWithCover(
      row.cover_image_url,
      row.property_images?.map((image) => ({
        id: String(image.id || image.image_url || ""),
        image_url: String(image.image_url || ""),
        position: typeof image.position === "number" ? image.position : undefined,
        created_at: typeof image.created_at === "string" ? image.created_at : undefined,
        width: typeof image.width === "number" ? image.width : null,
        height: typeof image.height === "number" ? image.height : null,
        bytes: typeof image.bytes === "number" ? image.bytes : null,
        format: typeof image.format === "string" ? image.format : null,
      }))
    ),
  })) as Property[]);

  const savedIds = user
    ? await fetchSavedPropertyIds({
        supabase,
        userId: user.id,
        propertyIds: properties.map((property) => property.id),
      })
    : new Set<string>();
  const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE));
  const prevHref =
    page > 1
      ? `/shortlets?${new URLSearchParams({
          ...(city ? { city } : {}),
          page: String(page - 1),
        }).toString()}`
      : null;
  const nextHref =
    page < totalPages
      ? `/shortlets?${new URLSearchParams({
          ...(city ? { city } : {}),
          page: String(page + 1),
        }).toString()}`
      : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 px-4 py-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Shortlet stays</p>
        <h1 className="text-2xl font-semibold text-slate-900">Browse shortlets</h1>
        <p className="mt-1 text-sm text-slate-600">
          Find nightly stays. Pricing breakdown appears on each listing page before you book.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <form className="flex items-center gap-2">
            <input
              type="text"
              name="city"
              defaultValue={city ?? ""}
              placeholder="City (e.g. Lagos)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white"
            >
              Search
            </button>
          </form>
          <Link
            href="/properties"
            className="inline-flex h-10 items-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to all homes
          </Link>
        </div>
      </div>

      {properties.length ? (
        <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              showSave={!!user}
              initialSaved={savedIds.has(property.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
          No shortlet listings found for this filter.
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-600">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {prevHref ? (
            <Link
              href={prevHref}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Previous
            </Link>
          ) : null}
          {nextHref ? (
            <Link
              href={nextHref}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

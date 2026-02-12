import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/authz";
import { createServiceRoleClient, hasServiceRoleEnv } from "@/lib/supabase/admin";
import {
  buildDefaultSavedSearchName,
  normalizeSavedSearchFilters,
  stableStringify,
} from "@/lib/saved-searches/matching";
import {
  getPublicCollectionByShareId,
  isPubliclyVisibleCollectionListing,
} from "@/lib/saved-collections.server";
import {
  buildSavedSearchNameFromCollection,
  deriveSavedSearchFiltersFromCollectionListings,
} from "@/lib/saved-searches/from-collection";
import { includeDemoListingsForViewer } from "@/lib/properties/demo";

const routeLabel = "/api/saved-searches/from-collection";

const schema = z.object({
  shareId: z.string().uuid(),
});

type SavedSearchRow = {
  id: string;
  user_id: string;
  name: string;
  query_params: Record<string, unknown> | null;
  is_active?: boolean | null;
  alerts_enabled?: boolean | null;
  alert_frequency?: "instant" | "daily" | "weekly" | null;
  alert_last_sent_at?: string | null;
  alert_baseline_at?: string | null;
  created_at?: string | null;
  last_notified_at?: string | null;
  last_checked_at?: string | null;
};

export type SavedSearchFromCollectionDeps = {
  requireUser: typeof requireUser;
  hasServiceRoleEnv: typeof hasServiceRoleEnv;
  createServiceRoleClient: typeof createServiceRoleClient;
  getPublicCollectionByShareId: typeof getPublicCollectionByShareId;
};

const defaultDeps: SavedSearchFromCollectionDeps = {
  requireUser,
  hasServiceRoleEnv,
  createServiceRoleClient,
  getPublicCollectionByShareId,
};

function findDuplicateByFilters(input: {
  searches: SavedSearchRow[];
  filters: Record<string, unknown>;
}) {
  const canonical = stableStringify(normalizeSavedSearchFilters(input.filters));
  return input.searches.find((search) => {
    const current = normalizeSavedSearchFilters(search.query_params || {});
    return stableStringify(current) === canonical;
  });
}

export async function postSavedSearchFromCollectionResponse(
  request: Request,
  deps: SavedSearchFromCollectionDeps = defaultDeps
) {
  const startTime = Date.now();
  const auth = await deps.requireUser({ request, route: routeLabel, startTime });
  if (!auth.ok) return auth.response;

  if (!deps.hasServiceRoleEnv()) {
    return NextResponse.json(
      { error: "Saved search import from shortlist is unavailable right now." },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => null);
    const payload = schema.parse(body || {});

    const sharedCollection = await deps.getPublicCollectionByShareId({
      supabase: deps.createServiceRoleClient(),
      shareId: payload.shareId,
    });
    if (!sharedCollection) {
      return NextResponse.json({ error: "Shared collection not found." }, { status: 404 });
    }

    const includeDemo = includeDemoListingsForViewer({ viewerRole: null });
    const listings = sharedCollection.properties.filter((listing) =>
      isPubliclyVisibleCollectionListing({ listing, includeDemo })
    );

    if (!listings.length) {
      return NextResponse.json(
        { error: "No publicly visible listings are available to follow." },
        { status: 422 }
      );
    }

    const derivedFilters = deriveSavedSearchFiltersFromCollectionListings(listings);
    const fallbackCity = listings.find((listing) => listing.city?.trim())?.city?.trim() ?? null;
    const filters =
      Object.keys(derivedFilters).length > 0
        ? derivedFilters
        : fallbackCity
        ? normalizeSavedSearchFilters({ city: fallbackCity })
        : derivedFilters;

    if (!Object.keys(filters).length) {
      return NextResponse.json(
        { error: "We could not derive filters from this shortlist yet." },
        { status: 422 }
      );
    }

    const nowIso = new Date().toISOString();
    const name =
      buildSavedSearchNameFromCollection(sharedCollection.title) ||
      buildDefaultSavedSearchName(filters);

    const { data: existingRows, error: existingError } = await auth.supabase
      .from("saved_searches")
      .select(
        "id,user_id,name,query_params,is_active,alerts_enabled,alert_frequency,alert_last_sent_at,alert_baseline_at,created_at,last_notified_at,last_checked_at"
      )
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false });

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 });
    }

    const existing = (existingRows as unknown as SavedSearchRow[] | null) ?? [];
    const duplicate = findDuplicateByFilters({ searches: existing, filters });

    if (duplicate) {
      const { data: updated, error: updateError } = await auth.supabase
        .from("saved_searches")
        .update({
          query_params: filters,
          is_active: true,
          alerts_enabled: true,
          alert_baseline_at: duplicate.alert_baseline_at ?? nowIso,
        })
        .eq("id", duplicate.id)
        .eq("user_id", auth.user.id)
        .select(
          "id,user_id,name,query_params,is_active,alerts_enabled,alert_frequency,alert_last_sent_at,alert_baseline_at,created_at,last_notified_at,last_checked_at"
        )
        .maybeSingle<SavedSearchRow>();

      if (updateError || !updated) {
        return NextResponse.json(
          { error: updateError?.message || "Unable to update followed search." },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        upserted: true,
        search: updated,
        savedSearchId: updated.id,
        manageHref: "/saved-searches",
      });
    }

    const { data: created, error: insertError } = await auth.supabase
      .from("saved_searches")
      .insert({
        user_id: auth.user.id,
        name,
        query_params: filters,
        is_active: true,
        alerts_enabled: true,
        alert_frequency: "daily",
        alert_baseline_at: nowIso,
      })
      .select(
        "id,user_id,name,query_params,is_active,alerts_enabled,alert_frequency,alert_last_sent_at,alert_baseline_at,created_at,last_notified_at,last_checked_at"
      )
      .maybeSingle<SavedSearchRow>();

    if (insertError || !created) {
      return NextResponse.json(
        { error: insertError?.message || "Unable to follow shortlist search." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      upserted: false,
      search: created,
      savedSearchId: created.id,
      manageHref: "/saved-searches",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "shareId must be a valid UUID." }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Unable to follow shortlist search.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  return postSavedSearchFromCollectionResponse(request);
}

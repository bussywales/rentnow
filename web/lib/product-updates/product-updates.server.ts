import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/types";
import {
  getAllowedProductUpdateAudiences,
  type ProductUpdateSummary,
} from "@/lib/product-updates/audience";
import type { ProductUpdateAudience } from "@/lib/product-updates/constants";

export type ProductUpdateRow = {
  id: string;
  title: string;
  summary: string;
  image_url?: string | null;
  audience: ProductUpdateAudience;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ProductUpdateFeedItem = ProductUpdateRow & { is_read: boolean };

export async function fetchPublishedProductUpdates({
  client,
  role,
  limit = 50,
}: {
  client: SupabaseClient;
  role: UserRole | null;
  limit?: number;
}): Promise<ProductUpdateRow[]> {
  const audiences = getAllowedProductUpdateAudiences(role);
  let query = client
    .from("product_updates")
    .select("id,title,summary,image_url,audience,published_at,created_at,updated_at")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (audiences.length) {
    query = query.in("audience", audiences);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as ProductUpdateRow[]) ?? [];
}

export async function fetchPublishedProductUpdateIds({
  client,
  role,
  limit = 200,
}: {
  client: SupabaseClient;
  role: UserRole | null;
  limit?: number;
}): Promise<ProductUpdateSummary[]> {
  const audiences = getAllowedProductUpdateAudiences(role);
  let query = client
    .from("product_updates")
    .select("id,audience,published_at")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(limit);

  if (audiences.length) {
    query = query.in("audience", audiences);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as ProductUpdateSummary[]) ?? [];
}

export async function fetchProductUpdateReadIds({
  client,
  userId,
  updateIds,
}: {
  client: SupabaseClient;
  userId: string;
  updateIds: string[];
}): Promise<Set<string>> {
  if (!updateIds.length) return new Set();
  const { data, error } = await client
    .from("product_update_reads")
    .select("update_id")
    .eq("user_id", userId)
    .in("update_id", updateIds);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.update_id));
}

export async function buildProductUpdatesFeed({
  client,
  role,
  userId,
  limit = 50,
}: {
  client: SupabaseClient;
  role: UserRole | null;
  userId: string;
  limit?: number;
}): Promise<ProductUpdateFeedItem[]> {
  const updates = await fetchPublishedProductUpdates({ client, role, limit });
  const readIds = await fetchProductUpdateReadIds({
    client,
    userId,
    updateIds: updates.map((update) => update.id),
  });

  return updates.map((update) => ({
    ...update,
    is_read: readIds.has(update.id),
  }));
}

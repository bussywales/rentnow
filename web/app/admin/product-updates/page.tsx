import { redirect } from "next/navigation";
import { AdminProductUpdatesPanel, type AdminProductUpdateRow } from "@/components/admin/AdminProductUpdatesPanel";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { isProductUpdateAudience } from "@/lib/product-updates/audience";
import type { ProductUpdateAudience } from "@/lib/product-updates/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function requireAdmin() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/admin/product-updates&reason=auth");
  }
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/product-updates&reason=auth");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") {
    redirect("/forbidden?reason=role");
  }
  return supabase;
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminProductUpdatesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await requireAdmin();

  const statusParam = typeof searchParams.status === "string" ? searchParams.status : null;
  const audienceParam = typeof searchParams.audience === "string" ? searchParams.audience : null;
  const safeAudience: ProductUpdateAudience | null =
    isProductUpdateAudience(audienceParam) ? audienceParam : null;

  let query = supabase
    .from("product_updates")
    .select("id,title,summary,body,image_url,audience,published_at,created_at,updated_at,created_by")
    .order("updated_at", { ascending: false });

  if (statusParam === "draft") {
    query = query.is("published_at", null);
  } else if (statusParam === "published") {
    query = query.not("published_at", "is", null);
  }

  if (safeAudience) {
    query = query.eq("audience", safeAudience);
  }

  const { data, error } = await query;
  const updates = (data as AdminProductUpdateRow[]) || [];

  if (error) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Product updates</h1>
        <p className="text-sm text-rose-600">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <AdminProductUpdatesPanel
        initialUpdates={updates}
        initialStatus={statusParam}
        initialAudience={safeAudience ?? "all"}
      />
    </div>
  );
}

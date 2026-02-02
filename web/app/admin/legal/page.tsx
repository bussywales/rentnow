import { redirect } from "next/navigation";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { AdminLegalDocumentsPanel, type AdminLegalDocRow } from "@/components/admin/AdminLegalDocumentsPanel";
import { DEFAULT_JURISDICTION } from "@/lib/legal/constants";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function requireAdmin() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/admin/legal&reason=auth");
  }
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/legal&reason=auth");
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

export default async function AdminLegalPage() {
  const supabase = await requireAdmin();
  const { data, error } = await supabase
    .from("legal_documents")
    .select("id, jurisdiction, audience, version, status, title, effective_at, published_at, updated_at")
    .eq("jurisdiction", DEFAULT_JURISDICTION)
    .order("audience", { ascending: true })
    .order("version", { ascending: false });

  const documents = (data as AdminLegalDocRow[]) || [];

  if (error) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Legal documents</h1>
        <p className="text-sm text-rose-600">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-4">
      <AdminLegalDocumentsPanel initialDocuments={documents} jurisdiction={DEFAULT_JURISDICTION} />
    </div>
  );
}

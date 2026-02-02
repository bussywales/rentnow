import { redirect } from "next/navigation";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { AdminLegalEditor, type LegalEditorDoc } from "@/components/admin/AdminLegalEditor";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type RouteContext = { params: Promise<{ id: string }> };

async function requireAdmin(id: string) {
  if (!hasServerSupabaseEnv()) {
    redirect(`/auth/required?redirect=/admin/legal/${id}&reason=auth`);
  }
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect(`/auth/required?redirect=/admin/legal/${id}&reason=auth`);
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

export default async function AdminLegalEditPage({ params }: RouteContext) {
  const { id } = await params;
  const supabase = await requireAdmin(id);

  const { data, error } = await supabase
    .from("legal_documents")
    .select(
      "id, jurisdiction, audience, version, status, title, content_md, change_log, effective_at, published_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
        <h1 className="text-2xl font-semibold text-slate-900">Legal document</h1>
        <p className="text-sm text-rose-600">{error?.message || "Document not found"}</p>
      </div>
    );
  }

  return <AdminLegalEditor mode="edit" initialDoc={data as LegalEditorDoc} />;
}

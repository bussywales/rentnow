import { redirect } from "next/navigation";
import AdminProductUpdatesImportClient from "@/components/admin/AdminProductUpdatesImportClient";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import { listUpdateNotes } from "@/lib/product-updates/update-notes.server";
import { mapUpdateAudiencesToProductAudiences } from "@/lib/product-updates/update-notes";
import { isProductUpdateAudience } from "@/lib/product-updates/audience";
import type { ProductUpdateAudience } from "@/lib/product-updates/constants";
import { summarizeUpdateImportStates } from "@/lib/product-updates/import-status";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

async function requireAdmin() {
  if (!hasServerSupabaseEnv()) {
    redirect("/auth/required?redirect=/admin/product-updates/import&reason=auth");
  }
  const { supabase, user } = await getServerAuthUser();
  if (!user) {
    redirect("/auth/required?redirect=/admin/product-updates/import&reason=auth");
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

export default async function AdminProductUpdatesImportPage() {
  const supabase = await requireAdmin();

  const { notes, invalidNotes } = await listUpdateNotes();
  const filenames = notes.map((note) => note.filename);

  let updates: Array<{
    id: string;
    source_ref: string | null;
    source_hash: string | null;
    audience: ProductUpdateAudience;
    published_at: string | null;
  }> = [];

  if (filenames.length > 0) {
    const { data } = await supabase
      .from("product_updates")
      .select("id, source_ref, source_hash, audience, published_at")
      .in("source_ref", filenames);
    updates = (data as typeof updates) ?? [];
  }

  const updateMap = new Map<string, typeof updates>();
  updates.forEach((update) => {
    const ref = update.source_ref;
    if (!ref) return;
    const list = updateMap.get(ref) ?? [];
    list.push(update);
    updateMap.set(ref, list);
  });

  const status = notes.map((note) => {
    const mappedAudiences = mapUpdateAudiencesToProductAudiences(note.audiences).filter(
      isProductUpdateAudience
    );
    const importedRows = updateMap.get(note.filename) ?? [];
    const importedAudiences = importedRows.map((row) => row.audience);
    const syncedAudiences = importedRows
      .filter((row) => row.source_hash === note.source_hash)
      .map((row) => row.audience);
    const draftAudiences = importedRows
      .filter((row) => row.published_at === null)
      .map((row) => row.audience);

    return {
      filename: note.filename,
      title: note.title,
      audiences: mappedAudiences,
      areas: note.areas,
      published_at: note.published_at,
      source_hash: note.source_hash,
      importedAudiences,
      syncedAudiences,
      draftAudiences,
    };
  });

  const importSummary = summarizeUpdateImportStates(status);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-4">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin tools</p>
        <h1 className="text-2xl font-semibold text-slate-900">Import update notes</h1>
        <p className="text-sm text-slate-600">
          Sync markdown updates into the Product Updates inbox as drafts or refresh existing
          notes.
        </p>
      </header>

      <AdminProductUpdatesImportClient
        notes={status}
        invalidNotes={invalidNotes}
        summary={importSummary}
      />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { DEFAULT_JURISDICTION, LEGAL_AUDIENCE_LABELS, type LegalAudience } from "@/lib/legal/constants";

export type AdminLegalDocRow = {
  id: string;
  jurisdiction: string;
  audience: LegalAudience;
  version: number;
  status: string;
  title: string;
  effective_at?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
};

type Props = {
  initialDocuments: AdminLegalDocRow[];
  jurisdiction?: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
}

function statusBadge(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "published") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized === "archived") {
    return "bg-slate-100 text-slate-600";
  }
  return "bg-amber-100 text-amber-700";
}

export function AdminLegalDocumentsPanel({ initialDocuments, jurisdiction }: Props) {
  const [docs, setDocs] = useState<AdminLegalDocRow[]>(initialDocuments);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const targetJurisdiction = jurisdiction || DEFAULT_JURISDICTION;

  const refreshDocuments = async () => {
    const res = await fetch(`/api/legal/documents?jurisdiction=${targetJurisdiction}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Unable to refresh documents");
      return;
    }
    setDocs((data?.documents || []) as AdminLegalDocRow[]);
  };

  const publishDoc = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/legal/documents/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to publish document");
        return;
      }
      await refreshDocuments();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Legal documents</h1>
          <p className="text-sm text-slate-600">
            Manage terms, policies, and acceptance requirements per audience.
          </p>
        </div>
        <Link
          href="/admin/legal/new"
          className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
        >
          Create draft
        </Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Audience</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Published</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={7}>
                  No legal documents yet.
                </td>
              </tr>
            )}
            {docs.map((doc) => (
              <tr key={doc.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {LEGAL_AUDIENCE_LABELS[doc.audience]}
                </td>
                <td className="px-4 py-3 text-slate-700">{doc.title}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(doc.status)}`}>
                    {doc.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">v{doc.version}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(doc.updated_at)}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(doc.published_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/legal/${doc.id}`}
                      className="text-xs font-semibold text-sky-700 hover:underline"
                    >
                      {doc.status === "draft" ? "Edit" : "View"}
                    </Link>
                    {doc.status === "draft" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => publishDoc(doc.id)}
                        disabled={pending}
                      >
                        {pending ? "Publishing..." : "Publish"}
                      </Button>
                    )}
                    <a
                      className="text-xs font-semibold text-slate-600 hover:underline"
                      href={`/api/admin/legal/documents/${doc.id}/export?format=pdf`}
                    >
                      PDF
                    </a>
                    <a
                      className="text-xs font-semibold text-slate-600 hover:underline"
                      href={`/api/admin/legal/documents/${doc.id}/export?format=docx`}
                    >
                      DOCX
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

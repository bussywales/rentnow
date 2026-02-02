"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { LegalMarkdown } from "@/components/legal/LegalMarkdown";
import { DEFAULT_JURISDICTION, LEGAL_AUDIENCES, LEGAL_AUDIENCE_LABELS, type LegalAudience } from "@/lib/legal/constants";
import { isLegalContentEmpty } from "@/lib/legal/markdown";

export type LegalEditorDoc = {
  id?: string;
  jurisdiction: string;
  audience: LegalAudience;
  version?: number;
  status?: string;
  title: string;
  content_md: string;
  change_log?: string | null;
  effective_at?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
};

type Props = {
  mode: "create" | "edit";
  initialDoc?: LegalEditorDoc;
  defaultAudience?: LegalAudience;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function toDateInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function AdminLegalEditor({ mode, initialDoc, defaultAudience }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initialDoc?.title ?? "");
  const [content, setContent] = useState(initialDoc?.content_md ?? "");
  const [changeLog, setChangeLog] = useState(initialDoc?.change_log ?? "");
  const [audience, setAudience] = useState<LegalAudience>(
    initialDoc?.audience ?? defaultAudience ?? "MASTER"
  );
  const [jurisdiction, setJurisdiction] = useState(
    initialDoc?.jurisdiction ?? DEFAULT_JURISDICTION
  );
  const [effectiveAt, setEffectiveAt] = useState(toDateInput(initialDoc?.effective_at));

  const status = initialDoc?.status ?? "draft";
  const versionLabel = initialDoc?.version ? `v${initialDoc.version}` : "";
  const isReadOnly = status === "published";
  const isContentEmpty = isLegalContentEmpty(content);

  const saveDraft = () => {
    setError(null);
    startTransition(async () => {
      const payload = {
        jurisdiction,
        audience,
        title,
        content_md: content,
        change_log: changeLog || null,
      };

      const res = await fetch(
        mode === "create" ? "/api/admin/legal/documents" : `/api/admin/legal/documents/${initialDoc?.id}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to save draft");
        return;
      }

      if (mode === "create") {
        const id = data?.document?.id;
        if (id) {
          router.replace(`/admin/legal/${id}`);
          router.refresh();
          return;
        }
      }

      router.refresh();
    });
  };

  const publish = () => {
    if (!initialDoc?.id) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/legal/documents/${initialDoc.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ effective_at: effectiveAt || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Unable to publish document");
        return;
      }
      router.refresh();
    });
  };

  const readOnlyNotice = useMemo(() => {
    if (!isReadOnly) return null;
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Published documents are read-only. Create a new draft to make edits.
      </div>
    );
  }, [isReadOnly]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            {mode === "create" ? "Create legal document" : "Legal document"}
          </h1>
          <p className="text-sm text-slate-600">
            {LEGAL_AUDIENCE_LABELS[audience]} {versionLabel && `• ${versionLabel}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/legal"
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:border-slate-300"
          >
            Back to list
          </Link>
          {initialDoc?.id && (
            <>
              <a
                className="text-xs font-semibold text-slate-600 hover:underline"
                href={`/api/admin/legal/documents/${initialDoc.id}/export?format=pdf`}
              >
                Download PDF
              </a>
              <a
                className="text-xs font-semibold text-slate-600 hover:underline"
                href={`/api/admin/legal/documents/${initialDoc.id}/export?format=docx`}
              >
                Download DOCX
              </a>
            </>
          )}
        </div>
      </div>

      {readOnlyNotice}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-500">Title</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={pending || isReadOnly}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Audience</label>
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value as LegalAudience)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={pending || mode === "edit"}
            >
              {LEGAL_AUDIENCES.map((value) => (
                <option key={value} value={value}>
                  {LEGAL_AUDIENCE_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Jurisdiction</label>
            <input
              type="text"
              value={jurisdiction}
              onChange={(event) => setJurisdiction(event.target.value.toUpperCase())}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={pending || mode === "edit"}
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Effective date</label>
            <input
              type="date"
              value={effectiveAt}
              onChange={(event) => setEffectiveAt(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={pending || isReadOnly}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-500">
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${activeTab === "edit" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
            onClick={() => setActiveTab("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 ${activeTab === "preview" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
            onClick={() => setActiveTab("preview")}
          >
            Preview
          </button>
        </div>

        {activeTab === "edit" ? (
          <div className="mt-3">
            <label className="text-xs font-semibold text-slate-500">Markdown content</label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="mt-1 min-h-[320px] w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={pending || isReadOnly}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <LegalMarkdown content={content} />
          </div>
        )}

        <div className="mt-4">
          <label className="text-xs font-semibold text-slate-500">Change log</label>
          <input
            type="text"
            value={changeLog}
            onChange={(event) => setChangeLog(event.target.value)}
            className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            disabled={pending || isReadOnly}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!isReadOnly && (
            <Button size="sm" onClick={saveDraft} disabled={pending || isContentEmpty || title.trim().length < 3}>
              {pending ? "Saving..." : "Save draft"}
            </Button>
          )}
          {status === "draft" && initialDoc?.id && (
            <Button size="sm" variant="secondary" onClick={publish} disabled={pending || isContentEmpty}>
              {pending ? "Publishing..." : "Publish"}
            </Button>
          )}
          {mode === "create" && (
            <p className="text-xs text-slate-500">
              Save the draft to generate a version before publishing.
            </p>
          )}
        </div>

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      </div>

      {initialDoc?.updated_at && (
        <p className="text-xs text-slate-500">
          Updated {formatDateTime(initialDoc.updated_at)} • Published {formatDateTime(initialDoc.published_at)}
        </p>
      )}
    </div>
  );
}

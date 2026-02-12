"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";

export type UpdateNoteImportStatus = {
  filename: string;
  title: string;
  audiences: string[];
  areas: string[];
  published_at?: string;
  source_hash: string;
  importedAudiences: string[];
  syncedAudiences: string[];
  draftAudiences: string[];
};

type InvalidUpdateNote = {
  filename: string;
  error: string;
};

type ImportSummary = {
  newSinceImport: number;
  needsSync: number;
  upToDate: number;
};

type Props = {
  notes: UpdateNoteImportStatus[];
  invalidNotes: InvalidUpdateNote[];
  summary: ImportSummary;
};

export default function AdminProductUpdatesImportClient({ notes, invalidNotes, summary }: Props) {
  const [pending, startTransition] = useTransition();
  const [importing, setImporting] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, string>>({});

  const handleImport = (filename: string) => {
    setImporting(filename);
    startTransition(async () => {
      const res = await fetch("/api/admin/product-updates/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus((prev) => ({ ...prev, [filename]: data?.error || "Import failed." }));
      } else {
        setStatus((prev) => ({ ...prev, [filename]: "Imported." }));
      }
      setImporting(null);
    });
  };

  if (!notes.length) {
    return (
      <div className="space-y-4">
        {invalidNotes.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">Some update notes could not be parsed.</p>
            <p className="mt-1 text-xs text-amber-800">
              Fix frontmatter in these files, then retry import.
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {invalidNotes.map((note) => (
                <li key={note.filename}>
                  <code className="font-semibold">{note.filename}</code>: {note.error}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
          No valid update notes found in <code className="font-semibold">web/docs/updates</code>.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm md:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">New since import</p>
          <p className="text-lg font-semibold text-slate-900">{summary.newSinceImport}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Needs sync</p>
          <p className="text-lg font-semibold text-slate-900">{summary.needsSync}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Up to date</p>
          <p className="text-lg font-semibold text-slate-900">{summary.upToDate}</p>
        </div>
      </div>

      {invalidNotes.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Skipped invalid notes</p>
          <p className="mt-1 text-xs text-amber-800">
            These files were skipped so the import page can still load.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {invalidNotes.map((note) => (
              <li key={note.filename}>
                <code className="font-semibold">{note.filename}</code>: {note.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {notes.map((note) => {
        const missingAudiences = note.audiences.filter(
          (audience) => !note.importedAudiences.includes(audience)
        );
        const needsSync = note.importedAudiences.some(
          (audience) => !note.syncedAudiences.includes(audience)
        );
        const hasDrafts = note.draftAudiences.length > 0;
        const badge = missingAudiences.length
          ? "Not imported"
          : needsSync
            ? "Needs update"
            : "Up to date";

        return (
          <div
            key={note.filename}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  {note.filename}
                </p>
                <h2 className="text-lg font-semibold text-slate-900">{note.title}</h2>
                <p className="text-sm text-slate-600">
                  Audiences: {note.audiences.join(", ") || "None"}
                </p>
                {note.areas.length > 0 && (
                  <p className="text-xs text-slate-500">Areas: {note.areas.join(", ")}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    badge === "Up to date"
                      ? "bg-emerald-100 text-emerald-700"
                      : badge === "Needs update"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  )}
                >
                  {badge}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending || importing === note.filename}
                  onClick={() => handleImport(note.filename)}
                >
                  {importing === note.filename ? "Importing…" : "Import as draft"}
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              {hasDrafts && (
                <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                  Drafts: {note.draftAudiences.join(", ")}
                </span>
              )}
              {note.published_at && (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                  Published at: {new Date(note.published_at).toLocaleDateString()}
                </span>
              )}
              {status[note.filename] && <span>{status[note.filename]}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

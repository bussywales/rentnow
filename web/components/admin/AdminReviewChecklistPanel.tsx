"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminReviewListItem } from "@/lib/admin/admin-review";
import {
  canApproveChecklist,
  deriveChecklistDefaults,
  type ChecklistSectionKey,
  type ChecklistStatus,
  type ReviewChecklist,
} from "@/lib/admin/admin-review-checklist";

const SECTION_LABELS: Record<ChecklistSectionKey, string> = {
  media: "Media",
  location: "Location",
  pricing: "Pricing",
  content: "Content",
  policy: "Policy/Safety",
};

const STATUS_LABELS: Record<ChecklistStatus, string> = {
  pass: "Pass",
  needs_fix: "Needs fix",
  blocker: "Blocker",
};

type Props = {
  listing: AdminReviewListItem | null;
  onChecklistChange?: (checklist: ReviewChecklist | null) => void;
  scrollToSection?: ChecklistSectionKey | null;
  onSectionScrolled?: () => void;
};

export function AdminReviewChecklistPanel({
  listing,
  onChecklistChange,
  scrollToSection,
  onSectionScrolled,
}: Props) {
  const [checklist, setChecklist] = useState<ReviewChecklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const sectionRefs = useMemo(
    () =>
      ({
        media: null,
        location: null,
        pricing: null,
        content: null,
        policy: null,
      }) as Record<ChecklistSectionKey, HTMLDivElement | null>,
    []
  );

  const listingId = listing?.id ?? null;

  const loadChecklist = useCallback(async () => {
    if (!listingId) {
      setChecklist(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSavedAt(null);
    const defaults = deriveChecklistDefaults(listing);
    try {
      const res = await fetch(`/api/admin/review/notes/${listingId}`);
      if (!res.ok) throw new Error("Unable to load checklist");
      const json = await res.json();
      const stored = json?.checklist as ReviewChecklist | null;
      const merged = stored
        ? {
            ...defaults,
            ...stored,
            sections: { ...defaults.sections, ...(stored.sections || {}) },
            internalNotes: stored.internalNotes ?? stored?.internalNotes ?? "",
          }
        : defaults;
      setChecklist(merged);
    } catch (err) {
      setChecklist(defaults);
      setError(err instanceof Error ? err.message : "Unable to load checklist");
    } finally {
      setLoading(false);
    }
  }, [listing, listingId]);

  useEffect(() => {
    loadChecklist().catch(() => undefined);
  }, [loadChecklist]);

  useEffect(() => {
    onChecklistChange?.(checklist);
  }, [checklist, onChecklistChange]);

  useEffect(() => {
    if (!scrollToSection) return;
    const target = sectionRefs[scrollToSection];
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        onSectionScrolled?.();
      });
    }
  }, [scrollToSection, sectionRefs, onSectionScrolled]);

  const updateSection = (section: ChecklistSectionKey, status: ChecklistStatus) => {
    setChecklist((prev) => {
      if (!prev) return prev;
      return { ...prev, sections: { ...prev.sections, [section]: status } };
    });
  };

  const updateNotes = (value: string) => {
    setChecklist((prev) => (prev ? { ...prev, internalNotes: value } : prev));
  };

  const saveChecklist = async () => {
    if (!listingId || !checklist) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/review/notes/${listingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Unable to save checklist");
      }
      const json = await res.json();
      setSavedAt(json?.updated_at || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save checklist");
    } finally {
      setLoading(false);
    }
  };

  const approveGuard = useMemo(() => canApproveChecklist(checklist), [checklist]);

  if (!listing) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
        Select a listing to see the review checklist.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-700">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Review checklist</p>
          <p className="text-sm font-semibold text-slate-900">Decision checklist</p>
        </div>
        <button
          type="button"
          onClick={saveChecklist}
          disabled={loading}
          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-sm"
        >
          {loading ? "Saving…" : "Save"}
        </button>
      </div>

      {checklist?.warnings?.length ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <div className="font-semibold text-amber-950">Auto warnings</div>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {checklist.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {Object.keys(SECTION_LABELS).map((key) => {
        const section = key as ChecklistSectionKey;
        const status = checklist?.sections?.[section] ?? null;
        return (
          <div
            key={section}
            ref={(node) => {
              sectionRefs[section] = node;
            }}
            data-checklist-section={section}
            className="mb-3 scroll-mt-24"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {SECTION_LABELS[section]}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(Object.keys(STATUS_LABELS) as ChecklistStatus[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => updateSection(section, option)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    status === option
                      ? option === "pass"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : option === "blocker"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {STATUS_LABELS[option]}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Internal notes
          <textarea
            value={checklist?.internalNotes ?? ""}
            onChange={(event) => updateNotes(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm"
            rows={3}
            placeholder="Notes for internal reviewers (not visible to hosts)"
          />
        </label>
      </div>

      {approveGuard.reason && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {approveGuard.reason}
        </div>
      )}
      {savedAt && (
        <div className="mt-2 text-xs text-slate-500">Saved {new Date(savedAt).toLocaleTimeString()}</div>
      )}
      {error && (
        <div className="mt-2 text-xs text-rose-600">{error}</div>
      )}
    </div>
  );
}

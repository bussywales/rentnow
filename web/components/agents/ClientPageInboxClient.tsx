"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { formatRelativeTime } from "@/lib/date/relative-time";
import { normalizeLeadTag } from "@/lib/leads/lead-notes";
import type { LeadStatus } from "@/lib/leads/types";

type ClientPageInfo = {
  id: string;
  name: string;
  requirements: string | null;
  slug: string;
};

type InboxLead = {
  id: string;
  property_id: string;
  thread_id?: string | null;
  status: LeadStatus;
  intent?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  message?: string | null;
  buyer?: {
    id?: string | null;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
  property?: {
    id?: string | null;
    title?: string | null;
    city?: string | null;
  } | null;
};

type LeadNote = {
  id: string;
  lead_id: string;
  author_user_id: string;
  body: string;
  visibility: string;
  created_at: string;
};

type LeadDetailState = {
  notes: LeadNote[];
  tags: string[];
  loading: boolean;
  error: string | null;
};

type Props = {
  clientPage: ClientPageInfo;
  initialLeads: InboxLead[];
  initialTotal: number;
  initialPageSize: number;
};

const DATE_FILTERS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "Last 30 days" },
] as const;

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "VIEWING", label: "Viewing" },
  { value: "QUALIFIED", label: "Offer" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
] as const;

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  VIEWING: "Viewing",
  QUALIFIED: "Offer",
  WON: "Won",
  LOST: "Lost",
  CLOSED: "Closed",
};

function leadLabel(status: LeadStatus) {
  return STATUS_LABELS[status] ?? status;
}

function resolveBuyerName(lead: InboxLead) {
  return lead.buyer?.name || "Prospect";
}

function resolveBuyerEmail(lead: InboxLead) {
  return lead.buyer?.email || "Email unavailable";
}

function resolvePropertyTitle(lead: InboxLead) {
  return lead.property?.title || "Listing";
}

function buildStatusOptions(current: LeadStatus) {
  const options = STATUS_FILTERS.filter((option) => option.value !== "all");
  if (options.some((option) => option.value === current)) return options;
  return [...options, { value: current, label: leadLabel(current) }];
}

export default function ClientPageInboxClient({
  clientPage,
  initialLeads,
  initialTotal,
  initialPageSize,
}: Props) {
  const [leads, setLeads] = useState<InboxLead[]>(initialLeads);
  const [total, setTotal] = useState(initialTotal);
  const [pageSize] = useState(initialPageSize);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [leadDetail, setLeadDetail] = useState<LeadDetailState>({
    notes: [],
    tags: [],
    loading: false,
    error: null,
  });
  const [noteDraft, setNoteDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [tagOptions, setTagOptions] = useState<string[]>([]);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [tagSaving, setTagSaving] = useState(false);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedId) ?? null,
    [leads, selectedId]
  );

  const hasMore = leads.length < total;

  const propertyOptions = useMemo(() => {
    const map = new Map<string, string>();
    leads.forEach((lead) => {
      if (!lead.property_id) return;
      map.set(lead.property_id, resolvePropertyTitle(lead));
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [leads]);

  const loadLeads = useCallback(async (nextPage: number, append: boolean) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(nextPage));
      params.set("pageSize", String(pageSize));
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (dateFilter !== "all") params.set("date", dateFilter);
      if (propertyFilter !== "all") params.set("property", propertyFilter);
      if (unreadOnly) params.set("unread", "true");

      const response = await fetch(
        `/api/agent/client-pages/${clientPage.id}/leads?${params.toString()}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load enquiries.");
      }
      setLeads((prev) => (append ? [...prev, ...(data.leads ?? [])] : data.leads ?? []));
      setTotal(typeof data.total === "number" ? data.total : data.leads?.length ?? 0);
      setPage(nextPage);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load enquiries.");
    } finally {
      setLoading(false);
    }
  }, [clientPage.id, dateFilter, pageSize, propertyFilter, statusFilter, unreadOnly]);

  useEffect(() => {
    void loadLeads(0, false);
    setSelectedId(null);
    setDrawerOpen(false);
  }, [dateFilter, loadLeads, propertyFilter, statusFilter, unreadOnly]);

  useEffect(() => {
    let ignore = false;
    const loadTags = async () => {
      try {
        const response = await fetch("/api/leads/tags");
        if (!response.ok) return;
        const data = await response.json();
        if (!ignore) setTagOptions(data.tags ?? []);
      } catch {
        // ignore
      }
    };
    loadTags();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen || !selectedLead) return;
    let ignore = false;

    const load = async () => {
      setLeadDetail({ notes: [], tags: [], loading: true, error: null });
      try {
        const response = await fetch(`/api/leads/${selectedLead.id}/notes`);
        if (!response.ok) {
          throw new Error("Unable to fetch notes");
        }
        const data = await response.json();
        if (ignore) return;
        setLeadDetail({
          notes: data.notes ?? [],
          tags: data.tags ?? [],
          loading: false,
          error: null,
        });
      } catch (error) {
        if (ignore) return;
        setLeadDetail((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Unable to fetch notes",
        }));
      }
    };

    void fetch(`/api/agent/client-pages/${clientPage.id}/leads/${selectedLead.id}/viewed`, {
      method: "POST",
    }).catch(() => undefined);

    load();
    return () => {
      ignore = true;
    };
  }, [drawerOpen, selectedLead, clientPage.id]);

  const handleSelectLead = (lead: InboxLead) => {
    setSelectedId(lead.id);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedId(null);
    setNoteDraft("");
    setTagDraft("");
  };

  const updateLeadStatus = async (leadId: string, status: LeadStatus) => {
    setStatusUpdating(true);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, clientPageId: clientPage.id }),
      });
      if (!response.ok) {
        throw new Error("Unable to update status");
      }
      const data = await response.json();
      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? { ...lead, status: data.lead.status } : lead))
      );
    } catch {
      // ignore
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedLead) return;
    const trimmed = noteDraft.trim();
    if (trimmed.length < 2) return;
    setNoteSaving(true);
    try {
      const response = await fetch(`/api/leads/${selectedLead.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!response.ok) throw new Error("Unable to add note");
      const data = await response.json();
      setLeadDetail((prev) => ({
        ...prev,
        notes: [data.note, ...prev.notes],
      }));
      setNoteDraft("");
    } catch {
      // ignore
    } finally {
      setNoteSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!selectedLead) return;
    try {
      const response = await fetch(`/api/leads/${selectedLead.id}/notes/${noteId}`, {
        method: "DELETE",
      });
      if (!response.ok) return;
      setLeadDetail((prev) => ({
        ...prev,
        notes: prev.notes.filter((note) => note.id !== noteId),
      }));
    } catch {
      // ignore
    }
  };

  const handleAddTag = async () => {
    if (!selectedLead) return;
    const normalized = normalizeLeadTag(tagDraft || "");
    if (!normalized) return;
    setTagSaving(true);
    try {
      const response = await fetch(`/api/leads/${selectedLead.id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: normalized }),
      });
      if (!response.ok) return;
      setLeadDetail((prev) => ({
        ...prev,
        tags: prev.tags.includes(normalized) ? prev.tags : [...prev.tags, normalized],
      }));
      if (!tagOptions.includes(normalized)) {
        setTagOptions((prev) => [...prev, normalized]);
      }
      setTagDraft("");
    } finally {
      setTagSaving(false);
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedLead) return;
    try {
      const response = await fetch(`/api/leads/${selectedLead.id}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag }),
      });
      if (!response.ok) return;
      setLeadDetail((prev) => ({
        ...prev,
        tags: prev.tags.filter((item) => item !== tag),
      }));
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Client inbox</p>
        <h1 className="text-2xl font-semibold text-slate-900">
          Enquiries for {clientPage.name}
        </h1>
        {clientPage.requirements && (
          <p className="text-sm text-slate-600" data-testid="client-page-inbox-summary">
            {clientPage.requirements}
          </p>
        )}
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),minmax(0,1fr)] lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
              data-testid="client-page-filter-status"
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Date range
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
              data-testid="client-page-filter-date"
            >
              {DATE_FILTERS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Property
            <select
              value={propertyFilter}
              onChange={(event) => setPropertyFilter(event.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700"
              data-testid="client-page-filter-property"
            >
              <option value="all">All properties</option>
              {propertyOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => setUnreadOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
              data-testid="client-page-filter-unread"
            />
            Unread only
          </label>
        </div>
      </section>

      {loadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          {loadError}
        </div>
      )}

      <section className="space-y-3">
        {leads.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-base font-semibold text-slate-900">No enquiries yet</p>
            <p className="mt-2 text-sm text-slate-600">
              When a client enquires from this page, it will show up here.
            </p>
          </div>
        ) : (
          leads.map((lead) => {
            const isNew = lead.status === "NEW";
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => handleSelectLead(lead)}
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300"
                data-testid={`client-page-lead-row-${lead.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {resolveBuyerName(lead)}
                      </p>
                      {isNew && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{resolveBuyerEmail(lead)}</p>
                    <p className="text-xs text-slate-500">{resolvePropertyTitle(lead)}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                        From client page
                      </span>
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 font-semibold text-slate-600">
                        {leadLabel(lead.status)}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {formatRelativeTime(lead.created_at)}
                  </div>
                </div>
              </button>
            );
          })
        )}
        {hasMore && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() => loadLeads(page + 1, true)}
              disabled={loading}
              data-testid="client-page-load-more"
            >
              {loading ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </section>

      {drawerOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/30 lg:items-stretch lg:justify-end">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close lead drawer"
            onClick={closeDrawer}
          />
          <aside
            className="relative w-full max-w-xl rounded-t-3xl border border-slate-200 bg-white p-6 shadow-2xl lg:h-full lg:max-w-[420px] lg:rounded-none lg:rounded-l-3xl"
            data-testid="client-page-lead-drawer"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Lead</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {resolveBuyerName(selectedLead)}
                </h2>
                <p className="text-sm text-slate-500">{resolveBuyerEmail(selectedLead)}</p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/properties/${selectedLead.property_id}`}
                  className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                >
                  Open listing
                </Link>
                {selectedLead.thread_id ? (
                  <Link
                    href={`/dashboard/messages?thread=${selectedLead.thread_id}`}
                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                  >
                    Message
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
                    No thread yet
                  </span>
                )}
                <Button type="button" variant="secondary" disabled title="Coming soon">
                  Schedule viewing
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
                <select
                  value={selectedLead.status}
                  onChange={(event) => updateLeadStatus(selectedLead.id, event.target.value as LeadStatus)}
                  disabled={statusUpdating}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  data-testid="client-page-lead-status"
                >
                  {buildStatusOptions(selectedLead.status).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-3 w-full justify-center"
                  onClick={() => updateLeadStatus(selectedLead.id, "LOST")}
                >
                  Archive / mark lost
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Client page</p>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <div className="font-semibold text-slate-700">{clientPage.name}</div>
                  {clientPage.requirements && (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      {clientPage.requirements}
                    </div>
                  )}
                  <span className="inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    From client page
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Notes</p>
                {leadDetail.loading && <p className="mt-2 text-xs text-slate-400">Loading…</p>}
                {leadDetail.error && (
                  <p className="mt-2 text-xs text-rose-600">{leadDetail.error}</p>
                )}
                <div className="mt-3 space-y-2">
                  {leadDetail.notes.length ? (
                    leadDetail.notes.map((note) => (
                      <div
                        key={note.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600"
                        data-testid="client-page-lead-note-item"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span>{formatRelativeTime(note.created_at)}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(note.id)}
                            className="text-xs text-slate-400 hover:text-slate-600"
                          >
                            Delete
                          </button>
                        </div>
                        <p className="mt-2 text-sm text-slate-700">{note.body}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">No notes yet.</p>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Add a private note"
                    data-testid="client-page-lead-note"
                  />
                  <Button size="sm" onClick={handleAddNote} disabled={noteSaving}>
                    {noteSaving ? "Saving" : "Add note"}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Tags</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {leadDetail.tags.length ? (
                    leadDetail.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag}
                        <span className="text-slate-400">×</span>
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">No tags yet.</span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Input
                    value={tagDraft}
                    onChange={(event) => setTagDraft(event.target.value)}
                    placeholder="Add tag"
                    list="client-page-lead-tags"
                    data-testid="client-page-lead-tag"
                  />
                  <datalist id="client-page-lead-tags">
                    {tagOptions.map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                  <Button size="sm" onClick={handleAddTag} disabled={tagSaving}>
                    {tagSaving ? "Adding" : "Add tag"}
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { cn } from "@/components/ui/cn";
import { normalizeLeadTag } from "@/lib/leads/lead-notes";
import type { LeadStatus } from "@/lib/leads/types";

export type LeadInboxRow = {
  id: string;
  property_id: string;
  thread_id?: string | null;
  status: LeadStatus;
  intent?: string | null;
  budget_min?: number | null;
  budget_max?: number | null;
  financing_status?: string | null;
  timeline?: string | null;
  message?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  contact_exchange_flags?: Record<string, unknown> | null;
  properties?: {
    id?: string | null;
    title?: string | null;
    city?: string | null;
    state_region?: string | null;
    listing_intent?: string | null;
  } | null;
  buyer?: { id?: string | null; full_name?: string | null } | null;
  owner?: { id?: string | null; full_name?: string | null } | null;
  lead_attributions?: {
    id?: string | null;
    client_page_id?: string | null;
    agent_user_id?: string | null;
    presenting_agent_id?: string | null;
    owner_user_id?: string | null;
    listing_id?: string | null;
    source?: string | null;
    created_at?: string | null;
    client_page?: {
      id?: string | null;
      client_slug?: string | null;
      client_name?: string | null;
      client_requirements?: string | null;
      agent_slug?: string | null;
    } | null;
  }[] | null;
  presenting_agent_profile?: {
    id?: string | null;
    full_name?: string | null;
    display_name?: string | null;
    business_name?: string | null;
  } | null;
  commission_agreement?: {
    id?: string | null;
    listing_id?: string | null;
    presenting_agent_id?: string | null;
    status?: string | null;
    commission_type?: string | null;
    commission_value?: number | null;
    currency?: string | null;
  } | null;
};

export type LeadInboxProps = {
  leads: LeadInboxRow[];
  viewerRole: "landlord" | "agent" | "admin";
  viewerId: string;
  isAdmin?: boolean;
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

type PipelineTab = {
  key: "new" | "contacted" | "viewing" | "won" | "lost" | "all";
  label: string;
  statuses: LeadStatus[];
};

const PIPELINE_TABS: PipelineTab[] = [
  { key: "new", label: "New", statuses: ["NEW"] },
  { key: "contacted", label: "Contacted", statuses: ["CONTACTED"] },
  { key: "viewing", label: "Viewing booked", statuses: ["VIEWING", "QUALIFIED"] },
  { key: "won", label: "Won", statuses: ["WON"] },
  { key: "lost", label: "Lost", statuses: ["LOST", "CLOSED"] },
  { key: "all", label: "All", statuses: [] },
];

const DATE_FILTERS = [
  { key: "all", label: "All time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "Last 30 days" },
] as const;

type DateFilterKey = (typeof DATE_FILTERS)[number]["key"];

type StatusOption = { value: LeadStatus; label: string };

const STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  VIEWING: "Viewing booked",
  WON: "Won",
  LOST: "Lost",
  QUALIFIED: "Qualified",
  CLOSED: "Closed",
};

const PRIMARY_STATUS_OPTIONS: StatusOption[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "VIEWING", label: "Viewing booked" },
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
];

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function formatLocation(lead: LeadInboxRow) {
  const city = lead.properties?.city ?? "";
  const region = lead.properties?.state_region ?? "";
  return [city, region].filter(Boolean).join(", ");
}

function buildStatusOptions(current: LeadStatus): StatusOption[] {
  if (PRIMARY_STATUS_OPTIONS.some((option) => option.value === current)) {
    return PRIMARY_STATUS_OPTIONS;
  }
  return [...PRIMARY_STATUS_OPTIONS, { value: current, label: STATUS_LABELS[current] ?? current }];
}

type LeadAttribution = {
  clientPageId: string;
  clientPageName: string | null;
  clientPageSlug: string | null;
  clientRequirements: string | null;
  agentSlug: string | null;
  source: string | null;
  presentingAgentId: string | null;
};

function resolveLeadAttribution(lead: LeadInboxRow): LeadAttribution | null {
  const attr = lead.lead_attributions?.[0];
  if (!attr?.client_page_id) return null;
  return {
    clientPageId: attr.client_page_id,
    clientPageName: attr.client_page?.client_name ?? null,
    clientPageSlug: attr.client_page?.client_slug ?? null,
    clientRequirements: attr.client_page?.client_requirements ?? null,
    agentSlug: attr.client_page?.agent_slug ?? null,
    source: attr.source ?? null,
    presentingAgentId: attr.presenting_agent_id ?? null,
  };
}

function resolvePresenterName(lead: LeadInboxRow) {
  const profile = lead.presenting_agent_profile;
  return (
    profile?.display_name ||
    profile?.full_name ||
    profile?.business_name ||
    null
  );
}

function resolveCommissionLabel(lead: LeadInboxRow) {
  const attr = lead.lead_attributions?.[0];
  if (!attr?.presenting_agent_id) return null;
  const agreement = lead.commission_agreement;
  if (!agreement) return "No";
  return agreement.status === "accepted" ? "Yes" : "No";
}

function resolveCommissionState(lead: LeadInboxRow) {
  const attr = lead.lead_attributions?.[0];
  if (!attr?.presenting_agent_id) return null;
  const agreement = lead.commission_agreement;
  if (!agreement) return "proposed";
  if (agreement.status === "accepted") return "accepted";
  return "proposed";
}

function formatCommissionTerms(agreement?: LeadInboxRow["commission_agreement"] | null) {
  if (!agreement) return null;
  if (agreement.commission_type === "none") return "None";
  if (agreement.commission_type === "percentage" && agreement.commission_value != null) {
    return `${agreement.commission_value}%`;
  }
  if (agreement.commission_type === "fixed" && agreement.commission_value != null) {
    const currency = agreement.currency || "NGN";
    return `${currency} ${agreement.commission_value}`;
  }
  return "Agreed";
}

function resolveLeadSource(lead: LeadInboxRow) {
  const attribution = resolveLeadAttribution(lead);
  if (attribution?.clientPageId) return "client_page";
  const flags = (lead.contact_exchange_flags ?? {}) as Record<string, unknown>;
  const moderation = flags.moderation as Record<string, unknown> | undefined;
  const source = typeof moderation?.source === "string" ? moderation.source : null;
  return source ? source.toLowerCase() : "direct";
}

export function LeadInboxClient({ leads, viewerRole, viewerId, isAdmin }: LeadInboxProps) {
  const [rows, setRows] = useState<LeadInboxRow[]>(leads);
  const [selectedTab, setSelectedTab] = useState<PipelineTab["key"]>("new");
  const [dateFilter, setDateFilter] = useState<DateFilterKey>("all");
  const [intentFilter, setIntentFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [clientPageFilter, setClientPageFilter] = useState("all");
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
    () => rows.find((lead) => lead.id === selectedId) ?? null,
    [rows, selectedId]
  );

  const selectedAttribution = useMemo(
    () => (selectedLead ? resolveLeadAttribution(selectedLead) : null),
    [selectedLead]
  );

  const selectedPresenterName = selectedLead ? resolvePresenterName(selectedLead) : null;
  const selectedCommissionTerms = selectedLead
    ? formatCommissionTerms(selectedLead.commission_agreement)
    : null;
  const selectedCommissionState = selectedLead ? resolveCommissionState(selectedLead) : null;

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

    load();
    return () => {
      ignore = true;
    };
  }, [drawerOpen, selectedLead]);

  useEffect(() => {
    let ignore = false;
    const loadTags = async () => {
      try {
        const response = await fetch("/api/leads/tags");
        if (!response.ok) return;
        const data = await response.json();
        if (!ignore) {
          setTagOptions(data.tags ?? []);
        }
      } catch {
        // ignore
      }
    };
    loadTags();
    return () => {
      ignore = true;
    };
  }, []);

  const tabsWithCounts = useMemo(() => {
    return PIPELINE_TABS.map((tab) => {
      const count = tab.statuses.length
        ? rows.filter((lead) => tab.statuses.includes(lead.status)).length
        : rows.length;
      return { ...tab, count };
    });
  }, [rows]);

  const intentOptions = useMemo(() => {
    const intents = new Set<string>();
    rows.forEach((lead) => {
      const intent = lead.properties?.listing_intent?.toLowerCase() ?? "";
      if (intent) intents.add(intent);
    });
    return Array.from(intents);
  }, [rows]);

  const cityOptions = useMemo(() => {
    const cities = new Set<string>();
    rows.forEach((lead) => {
      const city = lead.properties?.city?.trim();
      if (city) cities.add(city);
    });
    return Array.from(cities).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const sourceOptions = useMemo(() => {
    const sources = new Set<string>();
    rows.forEach((lead) => sources.add(resolveLeadSource(lead)));
    return Array.from(sources);
  }, [rows]);

  const clientPageOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((lead) => {
      const attribution = resolveLeadAttribution(lead);
      if (!attribution?.clientPageId) return;
      const label =
        attribution.clientPageName ||
        attribution.clientPageSlug ||
        attribution.clientPageId;
      if (!map.has(attribution.clientPageId)) {
        map.set(attribution.clientPageId, label);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const dayStart = startOfDay.getTime();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date();
    monthStart.setDate(monthStart.getDate() - 30);
    monthStart.setHours(0, 0, 0, 0);

    return rows.filter((lead) => {
      const tab = PIPELINE_TABS.find((item) => item.key === selectedTab) ?? PIPELINE_TABS[0];
      if (tab.statuses.length && !tab.statuses.includes(lead.status)) {
        return false;
      }

      const createdAt = toTimestamp(lead.created_at);
      if (dateFilter === "today" && createdAt < dayStart) return false;
      if (dateFilter === "week" && createdAt < weekStart.getTime()) return false;
      if (dateFilter === "month" && createdAt < monthStart.getTime()) return false;

      if (intentFilter !== "all") {
        const leadIntent = lead.properties?.listing_intent?.toLowerCase() ?? "";
        if (leadIntent !== intentFilter) return false;
      }

      if (cityFilter !== "all") {
        const leadCity = lead.properties?.city?.trim() ?? "";
        if (leadCity !== cityFilter) return false;
      }

      if (sourceFilter !== "all") {
        const source = resolveLeadSource(lead);
        if (source !== sourceFilter) return false;
      }

      if (clientPageFilter !== "all") {
        const attribution = resolveLeadAttribution(lead);
        if (!attribution?.clientPageId || attribution.clientPageId !== clientPageFilter) {
          return false;
        }
      }

      return true;
    });
  }, [rows, selectedTab, dateFilter, intentFilter, cityFilter, sourceFilter, clientPageFilter]);

  const highlights = useMemo(() => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const todayLeads = rows.filter((lead) => toTimestamp(lead.created_at) >= startOfDay.getTime());
    const weekLeads = rows.filter((lead) => toTimestamp(lead.created_at) >= weekStart.getTime());

    const wonToday = todayLeads.filter((lead) => lead.status === "WON").length;
    const wonWeek = weekLeads.filter((lead) => lead.status === "WON").length;

    const todayConversion = todayLeads.length
      ? Math.round((wonToday / todayLeads.length) * 100)
      : 0;
    const weekConversion = weekLeads.length ? Math.round((wonWeek / weekLeads.length) * 100) : 0;

    return {
      todayCount: todayLeads.length,
      todayConversion,
      weekCount: weekLeads.length,
      weekConversion,
    };
  }, [rows]);

  const handleSelectLead = (lead: LeadInboxRow) => {
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
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error("Unable to update status");
      }
      const data = await response.json();
      setRows((prev) =>
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
      if (!response.ok) {
        throw new Error("Unable to add note");
      }
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

  const renderEmptyState = () => {
    const isNewTab = selectedTab === "new";
    const linkHref = isAdmin ? "/admin/listings" : "/dashboard/properties";
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
        <p className="text-base font-semibold text-slate-900">
          {isNewTab ? "No new enquiries yet" : "No leads match this view"}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {isNewTab
            ? "New buy enquiries will appear here as soon as they are submitted."
            : "Try widening your filters or check back later."}
        </p>
        <div className="mt-5 flex justify-center">
          <Link
            href={linkHref}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
          >
            Browse listings
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Today</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{highlights.todayCount}</p>
          <p className="text-xs text-slate-500">{highlights.todayConversion}% conversion</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">This week</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{highlights.weekCount}</p>
          <p className="text-xs text-slate-500">{highlights.weekConversion}% conversion</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabsWithCounts.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSelectedTab(tab.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-semibold transition",
              selectedTab === tab.key
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
            data-testid={`lead-tab-${tab.key}`}
          >
            {tab.label}
            <span
              className={cn(
                "ml-2 rounded-full px-2 py-0.5 text-[11px]",
                selectedTab === tab.key
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-slate-600"
              )}
              data-testid={`lead-tab-count-${tab.key}`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Date range
          </span>
          <select
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value as DateFilterKey)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
          >
            {DATE_FILTERS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Listing intent
          </span>
          <select
            value={intentFilter}
            onChange={(event) => setIntentFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="all">All</option>
            {intentOptions.map((intent) => (
              <option key={intent} value={intent}>
                {intent === "buy" ? "For sale" : "For rent"}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            City
          </span>
          <select
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="all">All</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Source
          </span>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="all">All</option>
            {sourceOptions.map((source) => (
              <option key={source} value={source}>
                {source === "direct" ? "Direct" : source === "client_page" ? "Client page" : source}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Client page
          </span>
          <select
            value={clientPageFilter}
            onChange={(event) => setClientPageFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700"
          >
            <option value="all">All</option>
            {clientPageOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        renderEmptyState()
      ) : (
        <div className="space-y-3">
          {filteredRows.map((lead) => {
            const isNew = lead.status === "NEW";
            const updatedAt = lead.updated_at ?? lead.created_at;
            const isRecentlyUpdated = !isNew && Date.now() - toTimestamp(updatedAt) < 24 * 60 * 60 * 1000;
            const attribution = resolveLeadAttribution(lead);
            const presenterName = resolvePresenterName(lead);
            const commissionLabel = resolveCommissionLabel(lead);
            return (
              <button
                key={lead.id}
                type="button"
                className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300"
                onClick={() => handleSelectLead(lead)}
                data-testid={`lead-row-${lead.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">
                        {lead.properties?.title || "Listing"}
                      </h3>
                      {isNew && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          New
                        </span>
                      )}
                      {isRecentlyUpdated && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          Updated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{formatLocation(lead)}</p>
                    <p className="text-xs text-slate-500">
                      Buyer: {lead.buyer?.full_name || lead.buyer?.id || "Unknown"}
                    </p>
                    {isAdmin && (
                      <p className="text-xs text-slate-500">
                        Owner: {lead.owner?.full_name || lead.owner?.id || "Unknown"}
                      </p>
                    )}
                    {attribution?.clientPageId && (
                      <span className="inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        Client page: {attribution.clientPageName || attribution.clientPageSlug || "Client page"}
                      </span>
                    )}
                    {presenterName && (
                      <span className="inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        Introduced by {presenterName}
                      </span>
                    )}
                    {commissionLabel && (
                      <span className="inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        Commission agreed: {commissionLabel}
                      </span>
                    )}
                    <p className="text-xs text-slate-400">{formatDate(lead.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">
                      {STATUS_LABELS[lead.status] ?? lead.status}
                    </span>
                    <span className="text-xs text-slate-400">Open</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

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
            data-testid="lead-drawer"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Lead</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  {selectedLead.properties?.title || "Listing"}
                </h2>
                <p className="text-sm text-slate-500">{formatLocation(selectedLead)}</p>
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
                    Open thread
                  </Link>
                ) : (
                  <span className="inline-flex items-center rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400">
                    No thread yet
                  </span>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</p>
                <select
                  value={selectedLead.status}
                  onChange={(event) => updateLeadStatus(selectedLead.id, event.target.value as LeadStatus)}
                  disabled={statusUpdating}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  data-testid="lead-status-select"
                >
                  {buildStatusOptions(selectedLead.status).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Lead summary</p>
                <div className="mt-3 grid gap-2 text-xs text-slate-600">
                  <div>Buyer: {selectedLead.buyer?.full_name || selectedLead.buyer?.id || "Unknown"}</div>
                  {isAdmin && (
                    <div>Owner: {selectedLead.owner?.full_name || selectedLead.owner?.id || "Unknown"}</div>
                  )}
                  <div>Intent: {selectedLead.intent || "BUY"}</div>
                  <div>Budget: {selectedLead.budget_min || selectedLead.budget_max ? `${selectedLead.budget_min ?? "Any"} – ${selectedLead.budget_max ?? "Any"}` : "Not provided"}</div>
                  <div>Financing: {selectedLead.financing_status || "Not provided"}</div>
                  <div>Timeline: {selectedLead.timeline || "Not provided"}</div>
                </div>
                {selectedLead.message && (
                  <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    {selectedLead.message}
                  </div>
                )}
              </div>

              {selectedAttribution?.clientPageId && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Context</p>
                  <div className="mt-3 space-y-2 text-xs text-slate-600">
                    {selectedPresenterName && (
                      <div>
                        Introduced by:{" "}
                        <span className="font-semibold text-slate-700">{selectedPresenterName}</span>
                      </div>
                    )}
                    <div>
                      Client page:{" "}
                      <span className="font-semibold text-slate-700">
                        {selectedAttribution.clientPageName ||
                          selectedAttribution.clientPageSlug ||
                          selectedAttribution.clientPageId}
                      </span>
                    </div>
                    {selectedCommissionState && (
                      <div>
                        {selectedCommissionState === "accepted"
                          ? "Commission agreed"
                          : "Commission proposed (not accepted)"}
                      </div>
                    )}
                    {selectedCommissionTerms && (
                      <div className="text-xs text-slate-500">Terms: {selectedCommissionTerms}</div>
                    )}
                    {selectedCommissionState && (
                      <div className="text-[11px] text-slate-400">
                        PropatyHub only records this agreement; payment is handled off-platform.
                      </div>
                    )}
                    {selectedAttribution.clientRequirements && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                        {selectedAttribution.clientRequirements}
                      </div>
                    )}
                    {selectedAttribution.agentSlug && selectedAttribution.clientPageSlug && (
                      <Link
                        href={`/agents/${selectedAttribution.agentSlug}/c/${selectedAttribution.clientPageSlug}`}
                        target="_blank"
                        className="inline-flex w-fit items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
                      >
                        Open client page
                      </Link>
                    )}
                  </div>
                </div>
              )}

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
                    list="lead-tag-options"
                    data-testid="lead-tag-input"
                  />
                  <datalist id="lead-tag-options">
                    {tagOptions.map((tag) => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                  <Button size="sm" onClick={handleAddTag} disabled={tagSaving}>
                    {tagSaving ? "Adding" : "Add tag"}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Notes</p>
                {leadDetail.error && (
                  <p className="mt-2 text-xs text-rose-600">{leadDetail.error}</p>
                )}
                {leadDetail.loading ? (
                  <p className="mt-3 text-xs text-slate-400">Loading notes...</p>
                ) : leadDetail.notes.length ? (
                  <div className="mt-3 space-y-3">
                    {leadDetail.notes.map((note) => (
                      <div key={note.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                        <div className="flex items-center justify-between gap-2">
                          <span>{note.author_user_id === viewerId ? "You" : "Team"}</span>
                          <span className="text-[11px] text-slate-400">{formatDate(note.created_at)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{note.body}</p>
                        {(viewerRole === "admin" || note.author_user_id === viewerId) && (
                          <button
                            type="button"
                            className="mt-2 text-[11px] font-semibold text-rose-600"
                            onClick={() => handleDeleteNote(note.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-400">No notes yet.</p>
                )}

                <div className="mt-4 space-y-2">
                  <Textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Add a private note"
                    rows={3}
                    data-testid="lead-note-input"
                  />
                  <Button onClick={handleAddNote} disabled={noteSaving} data-testid="lead-note-submit">
                    {noteSaving ? "Saving" : "Add note"}
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

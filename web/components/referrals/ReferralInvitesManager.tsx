"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";

type Invite = {
  id: string;
  owner_id: string;
  campaign_id: string | null;
  invitee_name: string;
  invitee_contact: string | null;
  status: "draft" | "sent" | "reminded" | "converted" | "closed";
  reminder_at: string | null;
  notes: string | null;
  created_at: string;
};

type Campaign = {
  id: string;
  name: string;
};

type Props = {
  initialInvites: Invite[];
  campaigns: Campaign[];
};

type Filter = "all" | "due_today" | "overdue" | "upcoming";

function formatDate(value: string | null) {
  if (!value) return "No reminder";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No reminder";
  return date.toLocaleDateString();
}

function classifyInvite(invite: Invite, now = new Date()) {
  if (!invite.reminder_at) return "none" as const;
  const reminder = new Date(invite.reminder_at);
  if (Number.isNaN(reminder.getTime())) return "none" as const;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const reminderDay = new Date(reminder.getFullYear(), reminder.getMonth(), reminder.getDate()).getTime();
  if (reminderDay === today) return "due_today" as const;
  if (reminderDay < today) return "overdue" as const;
  return "upcoming" as const;
}

export default function ReferralInvitesManager({ initialInvites, campaigns }: Props) {
  const [invites, setInvites] = useState<Invite[]>(initialInvites);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [form, setForm] = useState({
    invitee_name: "",
    invitee_contact: "",
    campaign_id: "",
    reminder_at: "",
    notes: "",
    status: "sent",
  });

  const filteredInvites = useMemo(() => {
    if (filter === "all") return invites;
    return invites.filter((invite) => classifyInvite(invite) === filter);
  }, [filter, invites]);

  const createInvite = async () => {
    setPending(true);
    setError(null);
    setToast(null);
    try {
      const response = await fetch("/api/referrals/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitee_name: form.invitee_name,
          invitee_contact: form.invitee_contact || null,
          campaign_id: form.campaign_id || null,
          reminder_at: form.reminder_at ? new Date(form.reminder_at).toISOString() : null,
          notes: form.notes || null,
          status: form.status,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setError(String(payload?.error || "Unable to add invite."));
        return;
      }
      setInvites((current) => [payload.invite as Invite, ...current]);
      setForm({
        invitee_name: "",
        invitee_contact: "",
        campaign_id: "",
        reminder_at: "",
        notes: "",
        status: "sent",
      });
      setToast("Invite saved.");
    } catch {
      setError("Unable to add invite.");
    } finally {
      setPending(false);
    }
  };

  const updateStatus = async (id: string, status: Invite["status"]) => {
    setPending(true);
    setError(null);
    setToast(null);
    try {
      const response = await fetch(`/api/referrals/invites/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        setError(String(payload?.error || "Unable to update invite."));
        return;
      }
      setInvites((current) =>
        current.map((invite) => (invite.id === id ? (payload.invite as Invite) : invite))
      );
      setToast("Invite updated.");
    } catch {
      setError("Unable to update invite.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Invite reminders</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track who you invited, when to follow up, and which invites converted. This does not send outbound messages yet.
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link href="/dashboard/referrals" className="font-semibold text-slate-900 underline underline-offset-4">
            Back to referrals
          </Link>
          <Link href="/dashboard/referrals/campaigns" className="font-semibold text-slate-900 underline underline-offset-4">
            Campaign analytics
          </Link>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Add invite entry</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-wide text-slate-500">Invitee name</span>
            <Input
              value={form.invitee_name}
              onChange={(event) => setForm((current) => ({ ...current, invitee_name: event.target.value }))}
              placeholder="e.g. David Adewale"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-wide text-slate-500">Optional contact</span>
            <Input
              value={form.invitee_contact}
              onChange={(event) => setForm((current) => ({ ...current, invitee_contact: event.target.value }))}
              placeholder="Phone or email"
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-wide text-slate-500">Campaign</span>
            <Select
              value={form.campaign_id}
              onChange={(event) => setForm((current) => ({ ...current, campaign_id: event.target.value }))}
            >
              <option value="">None</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="space-y-1 text-sm text-slate-700">
            <span className="text-xs uppercase tracking-wide text-slate-500">Reminder date</span>
            <Input
              type="date"
              value={form.reminder_at}
              onChange={(event) => setForm((current) => ({ ...current, reminder_at: event.target.value }))}
            />
          </label>
          <label className="space-y-1 text-sm text-slate-700 md:col-span-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">Notes</span>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Context for your follow-up"
            />
          </label>
        </div>
        <div className="mt-3">
          <Button type="button" size="sm" onClick={() => void createInvite()} disabled={pending}>
            {pending ? "Saving..." : "Save invite"}
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">Invite list</h2>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs">
            {([
              { label: "All", value: "all" },
              { label: "Due today", value: "due_today" },
              { label: "Overdue", value: "overdue" },
              { label: "Upcoming", value: "upcoming" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                className={`rounded-md px-2 py-1 font-semibold ${
                  filter === option.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                }`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {filteredInvites.length ? (
            filteredInvites.map((invite) => (
              <div
                key={invite.id}
                className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 md:grid-cols-[1.3fr_1fr_auto]"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{invite.invitee_name}</p>
                  <p className="text-xs text-slate-500">
                    {invite.invitee_contact || "No contact"} · Reminder: {formatDate(invite.reminder_at)}
                  </p>
                  {invite.notes ? <p className="text-xs text-slate-600">{invite.notes}</p> : null}
                </div>
                <p className="text-sm text-slate-700">Status: {invite.status}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void updateStatus(invite.id, "reminded")}
                    disabled={pending}
                  >
                    Mark reminded
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void updateStatus(invite.id, "converted")}
                    disabled={pending}
                  >
                    Mark converted
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">No invites in this filter.</p>
          )}
        </div>
      </section>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}
      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{toast}</div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  getDeliveryMonitorStatusLabel,
  getDeliveryMonitorStatusTone,
  getDeliveryMonitorTestingStatusLabel,
  getDeliveryMonitorTestingTone,
  type DeliveryMonitorMergedItem,
  type DeliveryMonitorStatus,
  type DeliveryMonitorTestingStatus,
} from "@/lib/admin/delivery-monitor";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: DeliveryMonitorStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getDeliveryMonitorStatusTone(status)}`}
    >
      {getDeliveryMonitorStatusLabel(status)}
    </span>
  );
}

function TestingBadge({ status }: { status: DeliveryMonitorTestingStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getDeliveryMonitorTestingTone(status)}`}
    >
      {getDeliveryMonitorTestingStatusLabel(status)}
    </span>
  );
}

function useSelectedItemKey() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedItemKey = searchParams.get("item");

  const setSelectedItemKey = (itemKey: string | null) => {
    const next = new URLSearchParams(searchParams.toString());
    if (itemKey) next.set("item", itemKey);
    else next.delete("item");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return { selectedItemKey, setSelectedItemKey };
}

function DeliveryMonitorDrawerContent({
  item,
  onClose,
}: {
  item: DeliveryMonitorMergedItem;
  onClose: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<DeliveryMonitorStatus>(item.effectiveStatus);
  const [testingStatus, setTestingStatus] = useState<DeliveryMonitorTestingStatus>(item.testingStatus);
  const [testerName, setTesterName] = useState(item.latestTestRun?.tester_name ?? "");
  const [testNotes, setTestNotes] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [saving, setSaving] = useState<null | "status" | "test" | "note">(null);

  useEffect(() => {
    setStatus(item.effectiveStatus);
    setTestingStatus(item.testingStatus);
    setTesterName(item.latestTestRun?.tester_name ?? "");
    setTestNotes("");
    setNoteBody("");
    setNotice(null);
  }, [item]);

  const latestOutcome = item.latestTestRun
    ? `${getDeliveryMonitorTestingStatusLabel(item.latestTestRun.testing_status)} by ${item.latestTestRun.tester_name}`
    : "No test result recorded yet.";

  async function submitStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("status");
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/delivery-monitor/${encodeURIComponent(item.key)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to update status.");
      setNotice({ tone: "success", message: "Delivery status updated." });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to update status." });
    } finally {
      setSaving(null);
    }
  }

  async function submitTestRun(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("test");
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/delivery-monitor/${encodeURIComponent(item.key)}/test-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testingStatus,
          testerName,
          notes: testNotes,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to save test result.");
      setNotice({ tone: "success", message: "Test result recorded." });
      setTestNotes("");
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to save test result." });
    } finally {
      setSaving(null);
    }
  }

  async function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving("note");
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/delivery-monitor/${encodeURIComponent(item.key)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Unable to save note.");
      setNotice({ tone: "success", message: "Note added." });
      setNoteBody("");
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Unable to save note." });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Delivery item</p>
          <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
          <p className="mt-1 text-sm text-slate-500">{item.workstream}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5" data-testid="delivery-monitor-drawer-content">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={item.effectiveStatus} />
          <TestingBadge status={item.testingStatus} />
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {item.owner}
          </span>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Description</p>
          <p className="mt-2 text-sm text-slate-700">{item.description}</p>
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-slate-500">Why it matters</p>
          <p className="mt-2 text-sm text-slate-700">{item.whyItMatters}</p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Delivered</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700" data-testid="delivery-monitor-delivered-list">
              {item.delivered.map((entry) => (
                <li key={entry} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Outstanding</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700" data-testid="delivery-monitor-outstanding-list">
              {item.outstanding.map((entry) => (
                <li key={entry} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span>{entry}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Testing guide</p>
              <p className="text-xs text-slate-500">Use this as the disciplined closure checklist for the item.</p>
            </div>
            <p className="text-xs text-slate-500">Latest outcome: {latestOutcome}</p>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700" data-testid="delivery-monitor-testing-guide">
            {item.testingGuide.map((entry) => (
              <li key={entry} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" />
                <span>{entry}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Current control state</p>
          <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Next action</dt>
              <dd className="mt-1 text-slate-700">{item.nextAction}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Last updated</dt>
              <dd className="mt-1 text-slate-700">{formatDateTime(item.lastUpdatedAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Latest note</dt>
              <dd className="mt-1 text-slate-700">{item.latestNote?.body || "No note recorded yet."}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-slate-500">Latest test</dt>
              <dd className="mt-1 text-slate-700">
                {item.latestTestRun
                  ? `${getDeliveryMonitorTestingStatusLabel(item.latestTestRun.testing_status)} • ${formatDateTime(item.latestTestRun.tested_at)}`
                  : "No test result recorded yet."}
              </dd>
            </div>
          </dl>
        </section>

        {notice ? (
          <div
            className={`mt-4 rounded-xl border px-3 py-2 text-sm ${
              notice.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {notice.message}
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <form onSubmit={submitStatus} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Delivery status</p>
                <p className="text-xs text-slate-500">Use this only when the closure state has genuinely changed.</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as DeliveryMonitorStatus)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  data-testid="delivery-monitor-status-select"
                >
                  <option value="green">Green</option>
                  <option value="amber">Amber</option>
                  <option value="red">Red</option>
                </select>
                <Button type="submit" size="sm" disabled={saving === "status"}>
                  {saving === "status" ? "Saving..." : "Update status"}
                </Button>
              </div>
            </div>
          </form>

          <form onSubmit={submitTestRun} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Record test outcome</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-500">Testing state</span>
                <select
                  value={testingStatus}
                  onChange={(event) => setTestingStatus(event.target.value as DeliveryMonitorTestingStatus)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  data-testid="delivery-monitor-testing-status-select"
                >
                  <option value="not_started">Not started</option>
                  <option value="in_progress">In progress</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                </select>
              </label>
              <label className="text-sm text-slate-700">
                <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-500">Tester name</span>
                <input
                  value={testerName}
                  onChange={(event) => setTesterName(event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  placeholder="Tester name"
                  data-testid="delivery-monitor-tester-name-input"
                />
              </label>
            </div>
            <label className="mt-3 block text-sm text-slate-700">
              <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-500">Test notes</span>
              <textarea
                value={testNotes}
                onChange={(event) => setTestNotes(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                placeholder="What passed, what failed, and whether live/manual proof is still required."
                data-testid="delivery-monitor-test-notes-input"
              />
            </label>
            <div className="mt-3 flex justify-end">
              <Button type="submit" size="sm" disabled={saving === "test"}>
                {saving === "test" ? "Saving..." : "Record outcome"}
              </Button>
            </div>
          </form>

          <form onSubmit={submitNote} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Add note</p>
            <label className="mt-3 block text-sm text-slate-700">
              <span className="mb-1 block text-xs uppercase tracking-[0.16em] text-slate-500">Note</span>
              <textarea
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                placeholder="Record operator notes, closure blockers, or live-verification findings."
                data-testid="delivery-monitor-note-input"
              />
            </label>
            <div className="mt-3 flex justify-end">
              <Button type="submit" size="sm" disabled={saving === "note"}>
                {saving === "note" ? "Saving..." : "Add note"}
              </Button>
            </div>
          </form>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Recent notes</p>
            <div className="mt-3 space-y-3" data-testid="delivery-monitor-notes-log">
              {item.notesLog.length ? (
                item.notesLog.slice(0, 5).map((note) => (
                  <article key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm text-slate-800">{note.body}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {note.author_name} • {formatDateTime(note.created_at)}
                    </p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-500">No notes recorded yet.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Recent test outcomes</p>
            <div className="mt-3 space-y-3" data-testid="delivery-monitor-test-runs-log">
              {item.testRuns.length ? (
                item.testRuns.slice(0, 5).map((run) => (
                  <article key={run.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <TestingBadge status={run.testing_status} />
                      <span className="text-xs text-slate-500">{run.tester_name}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-800">{run.notes || "No detailed notes recorded."}</p>
                    <p className="mt-2 text-xs text-slate-500">{formatDateTime(run.tested_at)}</p>
                  </article>
                ))
              ) : (
                <p className="text-sm text-slate-500">No test outcomes recorded yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function AdminDeliveryMonitorClient({
  items,
}: {
  items: DeliveryMonitorMergedItem[];
}) {
  const { selectedItemKey, setSelectedItemKey } = useSelectedItemKey();
  const selectedItem = useMemo(
    () => items.find((item) => item.key === selectedItemKey) ?? null,
    [items, selectedItemKey]
  );

  const counts = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc[item.effectiveStatus] += 1;
        return acc;
      },
      { green: 0, amber: 0, red: 0 }
    );
  }, [items]);

  const drawerOpen = Boolean(selectedItem);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-4" data-testid="delivery-monitor-analytics">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Items</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{items.length}</p>
          <p className="mt-1 text-sm text-slate-600">Seeded delivery items</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-emerald-700">Green</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-900">{counts.green}</p>
          <p className="mt-1 text-sm text-emerald-800">Verified and effectively closed</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-amber-700">Amber</p>
          <p className="mt-2 text-3xl font-semibold text-amber-900">{counts.amber}</p>
          <p className="mt-1 text-sm text-amber-800">Live proof or ops follow-through still needed</p>
        </div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-rose-700">Red</p>
          <p className="mt-2 text-3xl font-semibold text-rose-900">{counts.red}</p>
          <p className="mt-1 text-sm text-rose-800">Material repo-truth gaps still open</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="delivery-monitor-list">
        <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto_minmax(0,1.2fr)_minmax(0,1.8fr)_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          <span>Title</span>
          <span>Workstream</span>
          <span>Status</span>
          <span>Testing</span>
          <span>Next action</span>
          <span>Last updated</span>
        </div>
        <div className="divide-y divide-slate-200">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setSelectedItemKey(item.key)}
              className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-slate-50 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_auto_minmax(0,1.2fr)_minmax(0,1.8fr)_auto]"
              data-testid={`delivery-monitor-item-${item.key}`}
            >
              <div>
                <p className="font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-500">{item.owner}</p>
              </div>
              <p className="text-sm text-slate-600">{item.workstream}</p>
              <div>
                <StatusBadge status={item.effectiveStatus} />
              </div>
              <div>
                <TestingBadge status={item.testingStatus} />
              </div>
              <p className="text-sm text-slate-600">{item.nextAction}</p>
              <p className="text-sm text-slate-500">{formatDateTime(item.lastUpdatedAt)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="hidden md:block">
        <div
          className={`fixed inset-0 z-40 ${drawerOpen ? "pointer-events-auto" : "pointer-events-none"}`}
          aria-hidden={!drawerOpen}
        >
          <button
            type="button"
            className={`absolute inset-0 bg-slate-900/30 transition-opacity ${drawerOpen ? "opacity-100" : "opacity-0"}`}
            onClick={() => setSelectedItemKey(null)}
            aria-label="Close delivery monitor drawer"
          />
          <aside
            className={`absolute right-0 top-0 h-full w-full max-w-2xl translate-x-full border-l border-slate-200 bg-white shadow-2xl transition-transform ${
              drawerOpen ? "translate-x-0" : ""
            }`}
            data-testid="delivery-monitor-drawer"
          >
            {selectedItem ? (
              <DeliveryMonitorDrawerContent
                item={selectedItem}
                onClose={() => setSelectedItemKey(null)}
              />
            ) : null}
          </aside>
        </div>
      </div>

      <BottomSheet
        open={drawerOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedItemKey(null);
        }}
        title={selectedItem?.title ?? "Delivery item"}
        description={selectedItem?.workstream}
        testId="delivery-monitor-bottom-sheet"
      >
        {selectedItem ? (
          <DeliveryMonitorDrawerContent item={selectedItem} onClose={() => setSelectedItemKey(null)} />
        ) : null}
      </BottomSheet>
    </>
  );
}

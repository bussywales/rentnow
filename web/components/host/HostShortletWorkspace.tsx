"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import type {
  HostShortletBookingSummary,
  HostShortletEarningSummary,
  HostShortletSettingSummary,
} from "@/lib/shortlet/shortlet.server";
import { classifyShortletBookingWindow } from "@/lib/shortlet/access";

type WorkspaceTab = "bookings" | "settings";

type SettingsFormState = {
  booking_mode: "instant" | "request";
  nightly_price_minor: string;
  cleaning_fee_minor: string;
  deposit_minor: string;
  min_nights: string;
  max_nights: string;
  advance_notice_hours: string;
  prep_days: string;
};

function formatMoney(currency: string, amountMinor: number): string {
  const amount = Math.max(0, Math.trunc(amountMinor || 0)) / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toFixed(2)}`;
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString();
}

function bookingStatusTone(status: HostShortletBookingSummary["status"]) {
  if (status === "confirmed" || status === "completed") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (status === "pending") return "text-sky-700 bg-sky-50 border-sky-200";
  if (status === "declined" || status === "cancelled" || status === "expired") {
    return "text-rose-700 bg-rose-50 border-rose-200";
  }
  return "text-slate-700 bg-slate-50 border-slate-200";
}

function toFormState(settings: HostShortletSettingSummary): SettingsFormState {
  return {
    booking_mode: settings.booking_mode,
    nightly_price_minor:
      typeof settings.nightly_price_minor === "number" && settings.nightly_price_minor > 0
        ? String(settings.nightly_price_minor)
        : "",
    cleaning_fee_minor: String(settings.cleaning_fee_minor ?? 0),
    deposit_minor: String(settings.deposit_minor ?? 0),
    min_nights: String(settings.min_nights ?? 1),
    max_nights:
      typeof settings.max_nights === "number" && settings.max_nights > 0
        ? String(settings.max_nights)
        : "",
    advance_notice_hours: String(settings.advance_notice_hours ?? 0),
    prep_days: String(settings.prep_days ?? 0),
  };
}

export function HostShortletWorkspace(props: {
  bookings: HostShortletBookingSummary[];
  settingsRows: HostShortletSettingSummary[];
  earnings: HostShortletEarningSummary[];
  defaultTab?: WorkspaceTab;
  showBookingTab?: boolean;
}) {
  const showBookingTab = props.showBookingTab ?? true;
  const resolvedDefaultTab =
    props.defaultTab && (!showBookingTab || props.defaultTab === "settings")
      ? props.defaultTab
      : "bookings";
  const [tab, setTab] = useState<WorkspaceTab>(resolvedDefaultTab);
  const [rows, setRows] = useState<HostShortletBookingSummary[]>(props.bookings);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingNotice, setBookingNotice] = useState<string | null>(null);
  const [settingsForms, setSettingsForms] = useState<Record<string, SettingsFormState>>(() =>
    Object.fromEntries(props.settingsRows.map((row) => [row.property_id, toFormState(row)]))
  );
  const [settingsBusyId, setSettingsBusyId] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<Record<string, string | null>>({});
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);

  useEffect(() => {
    setRows(props.bookings);
  }, [props.bookings]);

  useEffect(() => {
    if (!showBookingTab) {
      setTab("settings");
      return;
    }
    if (props.defaultTab === "settings" || props.defaultTab === "bookings") {
      setTab(props.defaultTab);
    }
  }, [props.defaultTab, showBookingTab]);

  useEffect(() => {
    setSettingsForms(
      Object.fromEntries(props.settingsRows.map((row) => [row.property_id, toFormState(row)]))
    );
  }, [props.settingsRows]);

  const incomingBookings = useMemo(
    () =>
      rows.filter(
        (row) =>
          classifyShortletBookingWindow({
            status: row.status,
            checkIn: row.check_in,
            checkOut: row.check_out,
          }) === "incoming"
      ),
    [rows]
  );
  const upcomingBookings = useMemo(
    () =>
      rows.filter(
        (row) =>
          classifyShortletBookingWindow({
            status: row.status,
            checkIn: row.check_in,
            checkOut: row.check_out,
          }) === "upcoming"
      ),
    [rows]
  );
  const pastBookings = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            classifyShortletBookingWindow({
              status: row.status,
              checkIn: row.check_in,
              checkOut: row.check_out,
            }) === "past"
        )
        .slice(0, 8),
    [rows]
  );

  const pendingPayout = useMemo(
    () =>
      props.earnings
        .filter((row) => row.payout_status === "eligible")
        .reduce((total, row) => total + row.amount_minor, 0),
    [props.earnings]
  );
  const paidOut = useMemo(
    () =>
      props.earnings
        .filter((row) => row.payout_status === "paid")
        .reduce((total, row) => total + row.amount_minor, 0),
    [props.earnings]
  );
  const earningsCurrency = props.earnings[0]?.currency || "NGN";

  const updateBookingRow = (bookingId: string, status: HostShortletBookingSummary["status"]) => {
    setRows((prev) =>
      prev.map((row) => (row.id === bookingId ? { ...row, status, expires_at: null } : row))
    );
  };

  async function respondToBooking(
    bookingId: string,
    action: "accept" | "decline",
    reason?: string
  ) {
    if (!bookingId || busyBookingId) return;
    setBusyBookingId(bookingId);
    setBookingError(null);
    setBookingNotice(null);
    try {
      const response = await fetch(`/api/shortlet/bookings/${bookingId}/respond`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason?.trim() || undefined }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { booking?: { status?: HostShortletBookingSummary["status"] }; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update booking");
      }
      const nextStatus = payload?.booking?.status ?? (action === "accept" ? "confirmed" : "declined");
      updateBookingRow(bookingId, nextStatus);
      setBookingNotice(
        action === "accept" ? "Booking confirmed." : "Booking request declined."
      );
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : "Unable to update booking");
    } finally {
      setBusyBookingId(null);
    }
  }

  async function cancelBooking(bookingId: string, reason?: string) {
    if (!bookingId || busyBookingId) return;
    setBusyBookingId(bookingId);
    setBookingError(null);
    setBookingNotice(null);
    try {
      const response = await fetch(`/api/shortlet/bookings/${bookingId}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason?.trim() || undefined }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { booking?: { status?: HostShortletBookingSummary["status"] }; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to cancel booking");
      }
      updateBookingRow(bookingId, "cancelled");
      setBookingNotice("Booking cancelled.");
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : "Unable to cancel booking");
    } finally {
      setBusyBookingId(null);
    }
  }

  async function handleBookingAction(
    row: HostShortletBookingSummary,
    action: "accept" | "decline" | "cancel"
  ) {
    if (action === "accept") {
      await respondToBooking(row.id, "accept");
      return;
    }
    if (action === "decline") {
      const reason = window.prompt("Reason for decline (optional)", "Dates not available");
      await respondToBooking(row.id, "decline", reason || undefined);
      return;
    }
    const reason = window.prompt("Reason for cancellation (optional)", "Host unavailable");
    await cancelBooking(row.id, reason || undefined);
  }

  function updateFormState(propertyId: string, next: Partial<SettingsFormState>) {
    setSettingsForms((prev) => ({
      ...prev,
      [propertyId]: {
        ...(prev[propertyId] ?? {
          booking_mode: "request",
          nightly_price_minor: "",
          cleaning_fee_minor: "0",
          deposit_minor: "0",
          min_nights: "1",
          max_nights: "",
          advance_notice_hours: "0",
          prep_days: "0",
        }),
        ...next,
      },
    }));
  }

  async function saveSettings(propertyId: string) {
    const form = settingsForms[propertyId];
    if (!form) return;
    const nightly = Number(form.nightly_price_minor);
    const minNights = Number(form.min_nights || "1");
    const maxNights =
      form.max_nights.trim().length > 0 ? Number(form.max_nights) : null;

    if (!Number.isFinite(nightly) || nightly <= 0) {
      setSettingsError((prev) => ({
        ...prev,
        [propertyId]: "Nightly price must be greater than 0 (in minor units).",
      }));
      return;
    }
    if (!Number.isFinite(minNights) || minNights < 1) {
      setSettingsError((prev) => ({
        ...prev,
        [propertyId]: "Minimum nights must be at least 1.",
      }));
      return;
    }
    if (maxNights !== null && (!Number.isFinite(maxNights) || maxNights < minNights)) {
      setSettingsError((prev) => ({
        ...prev,
        [propertyId]: "Max nights must be empty or greater than min nights.",
      }));
      return;
    }

    setSettingsBusyId(propertyId);
    setSettingsError((prev) => ({ ...prev, [propertyId]: null }));
    setSettingsNotice(null);
    try {
      const response = await fetch(`/api/shortlet/settings/${propertyId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_mode: form.booking_mode,
          nightly_price_minor: Math.trunc(nightly),
          cleaning_fee_minor: Math.max(0, Math.trunc(Number(form.cleaning_fee_minor || "0"))),
          deposit_minor: Math.max(0, Math.trunc(Number(form.deposit_minor || "0"))),
          min_nights: Math.max(1, Math.trunc(minNights)),
          max_nights: maxNights === null ? null : Math.trunc(maxNights),
          advance_notice_hours: Math.max(
            0,
            Math.trunc(Number(form.advance_notice_hours || "0"))
          ),
          prep_days: Math.max(0, Math.trunc(Number(form.prep_days || "0"))),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to update shortlet settings.");
      }
      setSettingsNotice("Shortlet pricing and rules updated.");
    } catch (error) {
      setSettingsError((prev) => ({
        ...prev,
        [propertyId]:
          error instanceof Error ? error.message : "Unable to update shortlet settings.",
      }));
    } finally {
      setSettingsBusyId(null);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Shortlet</p>
          <h3 className="text-lg font-semibold text-slate-900">
            {showBookingTab ? "Bookings and availability" : "Availability and pricing"}
          </h3>
          <p className="text-sm text-slate-600">
            {showBookingTab
              ? "Manage incoming booking requests and keep shortlet pricing/rules up to date."
              : "Manage booking mode, stay rules, and nightly pricing for shortlet listings."}
          </p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          Open by default in pilot
        </div>
      </div>

      {showBookingTab ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("bookings")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === "bookings"
                ? "bg-sky-600 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            Bookings
          </button>
          <button
            type="button"
            onClick={() => setTab("settings")}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              tab === "settings"
                ? "bg-sky-600 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            Availability & pricing
          </button>
        </div>
      ) : null}

      {showBookingTab && tab === "bookings" ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Incoming requests: <span className="font-semibold">{incomingBookings.length}</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Upcoming stays: <span className="font-semibold">{upcomingBookings.length}</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              Pending payout:{" "}
              <span className="font-semibold">{formatMoney(earningsCurrency, pendingPayout)}</span>
            </div>
          </div>

          {bookingError ? <p className="text-sm text-rose-600">{bookingError}</p> : null}
          {bookingNotice ? <p className="text-sm text-emerald-700">{bookingNotice}</p> : null}

          <div>
            <p className="text-sm font-semibold text-slate-900">Incoming booking requests</p>
            {incomingBookings.length ? (
              <div className="mt-2 space-y-2">
                {incomingBookings.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {row.property_title || "Shortlet listing"}
                        </p>
                        <p className="text-xs text-slate-600">
                          Guest: {row.guest_name || row.guest_user_id}
                        </p>
                        <p className="text-xs text-slate-600">
                          {formatDate(row.check_in)} to {formatDate(row.check_out)} · {row.nights} night
                          {row.nights === 1 ? "" : "s"}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-semibold ${bookingStatusTone(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                    </div>
                    {row.expires_at ? (
                      <p className="mt-1 text-xs text-amber-700">
                        Expires {new Date(row.expires_at).toLocaleString()}
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => void handleBookingAction(row, "accept")}
                        disabled={busyBookingId === row.id}
                      >
                        {busyBookingId === row.id ? "Updating..." : "Confirm booking"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleBookingAction(row, "decline")}
                        disabled={busyBookingId === row.id}
                      >
                        Decline booking
                      </Button>
                      <div className="text-xs font-semibold text-slate-800">
                        {formatMoney(row.currency, row.total_amount_minor)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No pending shortlet requests right now.</p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Upcoming stays</p>
            {upcomingBookings.length ? (
              <div className="mt-2 space-y-2">
                {upcomingBookings.map((row) => (
                  <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {row.property_title || "Shortlet listing"}
                        </p>
                        <p className="text-xs text-slate-600">
                          Guest: {row.guest_name || row.guest_user_id}
                        </p>
                        <p className="text-xs text-slate-600">
                          {formatDate(row.check_in)} to {formatDate(row.check_out)} · {row.nights} nights
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-2 py-1 text-xs font-semibold ${bookingStatusTone(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleBookingAction(row, "cancel")}
                        disabled={busyBookingId === row.id}
                      >
                        Cancel confirmed booking
                      </Button>
                      <span className="text-xs font-semibold text-slate-800">
                        {formatMoney(row.currency, row.total_amount_minor)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No upcoming shortlet stays yet.</p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900">Recent history</p>
            {pastBookings.length ? (
              <div className="mt-2 space-y-2">
                {pastBookings.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{row.property_title || "Shortlet listing"}</p>
                      <p className="text-xs text-slate-600">
                        {formatDate(row.check_in)} to {formatDate(row.check_out)} · Guest{" "}
                        {row.guest_name || row.guest_user_id}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs font-semibold ${bookingStatusTone(
                        row.status
                      )}`}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No completed or closed shortlet bookings yet.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            Paid out so far:{" "}
            <span className="font-semibold text-slate-900">
              {formatMoney(earningsCurrency, paidOut)}
            </span>{" "}
            · Manual payouts are handled by admin after stay completion.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Update nightly pricing and stay rules for each shortlet listing. Availability is open by
            default in the pilot.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/host/shortlets/blocks"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Manage calendar blocks
            </Link>
          </div>
          {settingsNotice ? <p className="text-sm text-emerald-700">{settingsNotice}</p> : null}
          {props.settingsRows.length ? (
            <div className="space-y-3">
              {props.settingsRows.map((row) => {
                const form = settingsForms[row.property_id] ?? toFormState(row);
                const error = settingsError[row.property_id];
                return (
                  <div key={row.property_id} className="rounded-xl border border-slate-200 p-3">
                    <p className="font-semibold text-slate-900">{row.property_title || row.property_id}</p>
                    <p className="text-xs text-slate-500">{row.property_city || "Unknown city"}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="text-xs text-slate-600">
                        Booking mode
                        <select
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          value={form.booking_mode}
                          onChange={(event) =>
                            updateFormState(row.property_id, {
                              booking_mode: event.target.value === "instant" ? "instant" : "request",
                            })
                          }
                        >
                          <option value="request">Request to book</option>
                          <option value="instant">Instant book</option>
                        </select>
                      </label>
                      <label className="text-xs text-slate-600">
                        Nightly (minor)
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          inputMode="numeric"
                          value={form.nightly_price_minor}
                          onChange={(event) =>
                            updateFormState(row.property_id, {
                              nightly_price_minor: event.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Cleaning fee (minor)
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          inputMode="numeric"
                          value={form.cleaning_fee_minor}
                          onChange={(event) =>
                            updateFormState(row.property_id, {
                              cleaning_fee_minor: event.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Deposit (minor)
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          inputMode="numeric"
                          value={form.deposit_minor}
                          onChange={(event) =>
                            updateFormState(row.property_id, {
                              deposit_minor: event.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Min nights
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          inputMode="numeric"
                          value={form.min_nights}
                          onChange={(event) =>
                            updateFormState(row.property_id, {
                              min_nights: event.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Max nights
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          inputMode="numeric"
                          value={form.max_nights}
                          placeholder="Optional"
                          onChange={(event) =>
                            updateFormState(row.property_id, {
                              max_nights: event.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Advance notice (hours)
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          inputMode="numeric"
                          value={form.advance_notice_hours}
                          onChange={(event) =>
                            updateFormState(row.property_id, {
                              advance_notice_hours: event.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                        />
                      </label>
                      <label className="text-xs text-slate-600">
                        Prep days
                        <input
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          inputMode="numeric"
                          value={form.prep_days}
                          onChange={(event) =>
                            updateFormState(row.property_id, {
                              prep_days: event.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                        />
                      </label>
                    </div>
                    {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => void saveSettings(row.property_id)}
                        disabled={settingsBusyId === row.property_id}
                      >
                        {settingsBusyId === row.property_id ? "Saving..." : "Save settings"}
                      </Button>
                      <span className="text-xs text-slate-500">
                        Guests see nightly, cleaning, deposit, and total breakdown in booking widget.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-600">
              No shortlet listings yet. Set listing intent to Shortlet in listing edit.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

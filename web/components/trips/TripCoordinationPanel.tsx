"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import type { ShortletBookingRow } from "@/lib/shortlet/shortlet.server";
import type { GuestCheckinVisibilityLevel, ShortletCheckinDetails } from "@/lib/shortlet/checkin-visibility";

type NoteTopic = "check_in" | "question" | "arrival_time" | "other";

function topicLabel(topic: NoteTopic) {
  if (topic === "check_in") return "Check-in details";
  if (topic === "arrival_time") return "Arrival time";
  if (topic === "question") return "General question";
  return "Other";
}

export function TripCoordinationPanel(props: {
  bookingId: string;
  bookingStatus: ShortletBookingRow["status"];
  propertyId: string;
  visibilityLevel: GuestCheckinVisibilityLevel;
  checkinDetails: ShortletCheckinDetails | null;
  respondByIso?: string | null;
  latestHostNote: {
    message: string;
    topic: NoteTopic;
    createdAt: string;
  } | null;
}) {
  const [topic, setTopic] = useState<NoteTopic>("check_in");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const mode = useMemo(() => {
    if (props.bookingStatus === "pending") return "awaiting_approval" as const;
    if (props.bookingStatus === "confirmed" || props.bookingStatus === "completed") {
      return "confirmed" as const;
    }
    if (
      props.bookingStatus === "declined" ||
      props.bookingStatus === "cancelled" ||
      props.bookingStatus === "expired"
    ) {
      return "closed" as const;
    }
    return "other" as const;
  }, [props.bookingStatus]);

  const emptyWaitWindow = useMemo(() => {
    if (!props.respondByIso) return "12 hours";
    const respondByDate = new Date(props.respondByIso);
    if (!Number.isFinite(respondByDate.getTime())) return "12 hours";
    const hoursRemaining = Math.max(1, Math.ceil((respondByDate.getTime() - Date.now()) / (60 * 60 * 1000)));
    return `${hoursRemaining} hour${hoursRemaining === 1 ? "" : "s"}`;
  }, [props.respondByIso]);

  const hostNoteTimestamp = useMemo(() => {
    if (!props.latestHostNote?.createdAt) return null;
    const date = new Date(props.latestHostNote.createdAt);
    if (!Number.isFinite(date.getTime())) return null;
    return date.toLocaleString();
  }, [props.latestHostNote?.createdAt]);

  function formatTime(value: string | null | undefined): string {
    if (!value) return "Not specified";
    const [hourText, minuteText = "00"] = value.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
  }

  function yesNoText(value: boolean | null | undefined) {
    if (value === true) return "Allowed";
    if (value === false) return "Not allowed";
    return "Not specified";
  }

  async function sendNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!message.trim()) {
      setError("Write a short message before sending.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/shortlet/bookings/${props.bookingId}/note`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          message: message.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to send note");
      }
      setMessage("");
      setNotice("Host note sent.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="trip-coordination-panel">
      <h2 className="text-base font-semibold text-slate-900">Your stay</h2>

      {props.latestHostNote ? (
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900" data-testid="trip-host-note-pinned">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Latest host note</p>
          <p className="mt-1 font-medium">{props.latestHostNote.message}</p>
          <p className="mt-1 text-xs text-sky-700">
            {topicLabel(props.latestHostNote.topic)}
            {hostNoteTimestamp ? ` • ${hostNoteTimestamp}` : ""}
          </p>
        </div>
      ) : null}

      {mode === "awaiting_approval" && !props.latestHostNote ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Host details pending</p>
          <p className="mt-1">Host will send check-in details within {emptyWaitWindow}.</p>
        </div>
      ) : null}

      {(mode === "awaiting_approval" || mode === "confirmed") ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700" data-testid="trip-stay-details">
          <p className="font-semibold text-slate-900">Check-in and arrival</p>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            <p>
              <span className="font-semibold text-slate-900">Check-in window:</span>{" "}
              {props.checkinDetails?.checkin_window_start || props.checkinDetails?.checkin_window_end
                ? `${formatTime(props.checkinDetails?.checkin_window_start)} - ${formatTime(props.checkinDetails?.checkin_window_end)}`
                : "Flexible"}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Checkout time:</span>{" "}
              {formatTime(props.checkinDetails?.checkout_time)}
            </p>
            {props.visibilityLevel === "full" && props.checkinDetails?.access_method ? (
              <p>
                <span className="font-semibold text-slate-900">Access:</span> {props.checkinDetails.access_method}
              </p>
            ) : null}
            {props.visibilityLevel === "full" && props.checkinDetails?.access_code_hint ? (
              <p>
                <span className="font-semibold text-slate-900">Access hint:</span> {props.checkinDetails.access_code_hint}
              </p>
            ) : null}
            {props.visibilityLevel === "full" && props.checkinDetails?.parking_info ? (
              <p className="sm:col-span-2">
                <span className="font-semibold text-slate-900">Parking:</span> {props.checkinDetails.parking_info}
              </p>
            ) : null}
            {props.visibilityLevel === "full" && props.checkinDetails?.wifi_info ? (
              <p className="sm:col-span-2">
                <span className="font-semibold text-slate-900">Wi-Fi:</span> {props.checkinDetails.wifi_info}
              </p>
            ) : null}
            {props.visibilityLevel === "full" && props.checkinDetails?.checkin_instructions ? (
              <p className="sm:col-span-2">
                <span className="font-semibold text-slate-900">Arrival instructions:</span>{" "}
                {props.checkinDetails.checkin_instructions}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {(mode === "awaiting_approval" || mode === "confirmed") ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700" data-testid="trip-house-rules">
          <p className="font-semibold text-slate-900">House rules</p>
          <div className="mt-2 space-y-1">
            {props.checkinDetails?.house_rules ? (
              <p>{props.checkinDetails.house_rules}</p>
            ) : (
              <p>Follow the listing guidance and respect the building rules.</p>
            )}
            <p>
              <span className="font-semibold text-slate-900">Quiet hours:</span>{" "}
              {props.checkinDetails?.quiet_hours_start || props.checkinDetails?.quiet_hours_end
                ? `${formatTime(props.checkinDetails?.quiet_hours_start)} - ${formatTime(props.checkinDetails?.quiet_hours_end)}`
                : "Not specified"}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Pets:</span> {yesNoText(props.checkinDetails?.pets_allowed)}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Smoking:</span> {yesNoText(props.checkinDetails?.smoking_allowed)}
            </p>
            <p>
              <span className="font-semibold text-slate-900">Parties:</span> {yesNoText(props.checkinDetails?.parties_allowed)}
            </p>
            {props.checkinDetails?.max_guests_override ? (
              <p>
                <span className="font-semibold text-slate-900">Max guests:</span> {props.checkinDetails.max_guests_override}
              </p>
            ) : null}
            {props.visibilityLevel === "full" && props.checkinDetails?.emergency_notes ? (
              <p>
                <span className="font-semibold text-slate-900">Emergency notes:</span> {props.checkinDetails.emergency_notes}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {mode === "closed" ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">This trip is closed</p>
          <p className="mt-1">You can find another stay and try new dates.</p>
          <Link
            href="/shortlets"
            className="mt-2 inline-flex text-sm font-semibold text-sky-700 underline underline-offset-2"
          >
            Find another stay
          </Link>
        </div>
      ) : null}

      {mode !== "closed" ? (
        <form className="mt-4 space-y-3" onSubmit={sendNote}>
          <div className="space-y-1">
            <label htmlFor="trip-note-topic" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Topic
            </label>
            <select
              id="trip-note-topic"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              value={topic}
              onChange={(event) => setTopic(event.target.value as NoteTopic)}
            >
              <option value="check_in">{topicLabel("check_in")}</option>
              <option value="arrival_time">{topicLabel("arrival_time")}</option>
              <option value="question">{topicLabel("question")}</option>
              <option value="other">{topicLabel("other")}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="trip-note-message" className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Message to host
            </label>
            <textarea
              id="trip-note-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              placeholder="Share arrival plans, questions, or check-in details."
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Sending..." : "Send host a note"}
            </button>
            <Link
              href="/support"
              className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Report an issue
            </Link>
            <Link
              href={`/properties/${props.propertyId}`}
              className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View listing
            </Link>
          </div>
        </form>
      ) : null}
    </section>
  );
}

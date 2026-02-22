"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import type { ShortletBookingRow } from "@/lib/shortlet/shortlet.server";

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
      <h2 className="text-base font-semibold text-slate-900">Coordination</h2>

      {mode === "awaiting_approval" ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">While you wait…</p>
          <p className="mt-1">Share any check-in constraints now so the host has context before deciding.</p>
        </div>
      ) : null}

      {mode === "confirmed" ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">Check-in info</p>
          <p className="mt-1">Check-in guidance will appear here when provided by the host.</p>
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

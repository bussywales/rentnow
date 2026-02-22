import Link from "next/link";
import type { TripTimelineStep } from "@/lib/shortlet/trip-timeline";

type TimelineModel = {
  current: TripTimelineStep;
  steps: Array<{ key: TripTimelineStep; label: string; status: "done" | "current" | "todo" }>;
  helperTitle: string;
  helperBody: string;
  nextActions: Array<{ label: string; href: string; kind: "primary" | "secondary" }>;
};

function stepTone(status: "done" | "current" | "todo") {
  if (status === "done") return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (status === "current") return "border-sky-300 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-white text-slate-500";
}

function formatDeadline(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleString();
}

function resolveTripStatusBanner(current: TripTimelineStep) {
  if (
    current === "payment_initiated" ||
    current === "payment_confirming" ||
    current === "request_sent"
  ) {
    return "Status: Request";
  }
  if (current === "awaiting_host_approval") {
    return "Status: Pending approval";
  }
  if (
    current === "reservation_confirmed" ||
    current === "upcoming" ||
    current === "in_stay"
  ) {
    return "Status: Confirmed";
  }
  if (current === "cancelled") return "Status: Cancelled";
  if (current === "expired") return "Status: Expired";
  if (current === "declined") return "Status: Declined";
  if (current === "completed") return "Status: Completed";
  if (current === "payment_failed") return "Status: Payment failed";
  if (current === "refunded") return "Status: Refunded";
  return "Status: Request";
}

export function TripTimeline(props: {
  timeline: TimelineModel;
  listingHref: string;
  respondByIso?: string | null;
}) {
  const respondByLabel = formatDeadline(props.respondByIso);
  const showRespondBy = props.timeline.current === "awaiting_host_approval";
  const statusBanner = resolveTripStatusBanner(props.timeline.current);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="trip-timeline">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">Trip timeline</h2>
        <Link
          href={props.listingHref}
          className="text-xs font-semibold text-sky-700 underline underline-offset-2"
        >
          View listing
        </Link>
      </div>

      <p
        className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700"
        data-testid="trip-status-banner"
      >
        {statusBanner}
      </p>

      <ol className="mt-3 space-y-2">
        {props.timeline.steps.map((step) => (
          <li
            key={step.key}
            className={`rounded-xl border px-3 py-2 text-sm ${stepTone(step.status)}`}
            data-testid={`trip-timeline-step-${step.key}`}
          >
            <span className="font-medium">{step.label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-900">{props.timeline.helperTitle}</p>
        <p className="mt-1 text-sm text-slate-700">{props.timeline.helperBody}</p>
        {showRespondBy ? (
          <p className="mt-1 text-xs text-slate-600">
            {respondByLabel
              ? `Host response deadline: ${respondByLabel}`
              : "Host response deadline: within 12 hours."}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {props.timeline.nextActions.map((action) => (
          <Link
            key={`${action.href}:${action.label}`}
            href={action.href}
            className={
              action.kind === "primary"
                ? "inline-flex items-center rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-700"
                : "inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            }
          >
            {action.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

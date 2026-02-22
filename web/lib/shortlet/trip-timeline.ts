import {
  normalizeShortletBookingStatus,
  normalizeShortletPaymentStatus,
  type ShortletBookingStatus,
  type ShortletPaymentStatus,
} from "@/lib/shortlet/return-status";

export type TripTimelineStep =
  | "payment_initiated"
  | "payment_confirming"
  | "request_sent"
  | "awaiting_host_approval"
  | "reservation_confirmed"
  | "upcoming"
  | "in_stay"
  | "completed"
  | "declined"
  | "cancelled"
  | "expired"
  | "payment_failed"
  | "refunded";

type TripTimelineStatus = "done" | "current" | "todo";

type TripTimelineAction = {
  label: string;
  href: string;
  kind: "primary" | "secondary";
};

type TripTimelineStepState = {
  key: TripTimelineStep;
  label: string;
  status: TripTimelineStatus;
};

const REQUEST_FLOW: TripTimelineStep[] = [
  "payment_initiated",
  "payment_confirming",
  "request_sent",
  "awaiting_host_approval",
  "reservation_confirmed",
  "upcoming",
  "in_stay",
  "completed",
];

const INSTANT_FLOW: TripTimelineStep[] = [
  "payment_initiated",
  "payment_confirming",
  "reservation_confirmed",
  "upcoming",
  "in_stay",
  "completed",
];

function parseDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) return null;
  return date;
}

function resolveDatePhase(input: {
  checkIn: string;
  checkOut: string;
  now: Date;
}): "upcoming" | "in_stay" | "completed" {
  const checkIn = parseDate(input.checkIn);
  const checkOut = parseDate(input.checkOut);
  if (!checkIn || !checkOut) return "upcoming";

  const nowMs = input.now.getTime();
  if (nowMs < checkIn.getTime()) return "upcoming";
  if (nowMs >= checkOut.getTime()) return "completed";
  return "in_stay";
}

function resolveCurrentStep(input: {
  bookingStatus: ShortletBookingStatus | null;
  paymentStatus: ShortletPaymentStatus | null;
  bookingMode: "request" | "instant";
  checkIn: string;
  checkOut: string;
  now: Date;
}): TripTimelineStep {
  if (input.paymentStatus === "refunded") return "refunded";
  if (input.paymentStatus === "failed") return "payment_failed";

  if (input.bookingStatus === "declined") return "declined";
  if (input.bookingStatus === "cancelled") return "cancelled";
  if (input.bookingStatus === "expired") return "expired";

  if (input.bookingStatus === "completed") return "completed";

  if (input.bookingStatus === "confirmed") {
    return resolveDatePhase({
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      now: input.now,
    });
  }

  if (input.bookingStatus === "pending") {
    return input.bookingMode === "request"
      ? "awaiting_host_approval"
      : "reservation_confirmed";
  }

  if (input.bookingStatus === "pending_payment") {
    if (input.paymentStatus === "succeeded") return "payment_confirming";
    return "payment_initiated";
  }

  if (input.paymentStatus === "succeeded") {
    return input.bookingMode === "request"
      ? "awaiting_host_approval"
      : "reservation_confirmed";
  }

  return "payment_initiated";
}

function resolveFlowIndex(flow: TripTimelineStep[], key: TripTimelineStep) {
  return flow.indexOf(key);
}

function resolveAnchorStep(current: TripTimelineStep, bookingMode: "request" | "instant") {
  if (current === "payment_failed" || current === "refunded") return "payment_confirming";
  if (current === "declined" || current === "expired") {
    return bookingMode === "request" ? "awaiting_host_approval" : "reservation_confirmed";
  }
  if (current === "cancelled") return "reservation_confirmed";
  return null;
}

function labelForStep(step: TripTimelineStep): string {
  switch (step) {
    case "payment_initiated":
      return "Payment initiated";
    case "payment_confirming":
      return "Payment confirming";
    case "request_sent":
      return "Request sent";
    case "awaiting_host_approval":
      return "Awaiting host approval";
    case "reservation_confirmed":
      return "Reservation confirmed";
    case "upcoming":
      return "Upcoming";
    case "in_stay":
      return "In stay";
    case "completed":
      return "Completed";
    case "declined":
      return "Declined";
    case "cancelled":
      return "Cancelled";
    case "expired":
      return "Expired";
    case "payment_failed":
      return "Payment failed";
    case "refunded":
      return "Refunded";
  }
}

function helperCopyForStep(current: TripTimelineStep): {
  helperTitle: string;
  helperBody: string;
  nextActions: TripTimelineAction[];
} {
  if (current === "awaiting_host_approval" || current === "request_sent") {
    return {
      helperTitle: "Host decision in progress",
      helperBody:
        "Your host has up to 12 hours to respond. We will notify you as soon as they approve or decline.",
      nextActions: [
        { label: "Back to trips", href: "/trips", kind: "primary" },
        { label: "Need help?", href: "/help", kind: "secondary" },
      ],
    };
  }

  if (current === "reservation_confirmed" || current === "upcoming") {
    return {
      helperTitle: "Reservation confirmed",
      helperBody: "Your stay is confirmed. Review trip details and prepare for check-in.",
      nextActions: [
        { label: "Back to trips", href: "/trips", kind: "primary" },
        { label: "Need help?", href: "/help", kind: "secondary" },
      ],
    };
  }

  if (current === "in_stay") {
    return {
      helperTitle: "You're currently in stay",
      helperBody: "Need assistance? Contact support and include your booking ID for faster help.",
      nextActions: [
        { label: "Get support", href: "/support", kind: "primary" },
        { label: "Back to trips", href: "/trips", kind: "secondary" },
      ],
    };
  }

  if (current === "completed") {
    return {
      helperTitle: "Trip completed",
      helperBody: "This stay is complete. You can keep exploring shortlets for your next trip.",
      nextActions: [
        { label: "Find another stay", href: "/shortlets", kind: "primary" },
        { label: "Back to trips", href: "/trips", kind: "secondary" },
      ],
    };
  }

  if (current === "declined" || current === "expired" || current === "cancelled") {
    return {
      helperTitle: "This trip is closed",
      helperBody: "You can try new dates or browse another shortlet that fits your plan.",
      nextActions: [
        { label: "Find another stay", href: "/shortlets", kind: "primary" },
        { label: "Back to trips", href: "/trips", kind: "secondary" },
      ],
    };
  }

  if (current === "payment_failed" || current === "refunded") {
    return {
      helperTitle: "Payment update needed",
      helperBody: "Payment did not complete for this booking. Start a new booking when ready.",
      nextActions: [
        { label: "Find another stay", href: "/shortlets", kind: "primary" },
        { label: "Need help?", href: "/help", kind: "secondary" },
      ],
    };
  }

  return {
    helperTitle: "Processing your booking",
    helperBody: "We're confirming your booking details. This usually completes in a few moments.",
    nextActions: [
      { label: "Back to trips", href: "/trips", kind: "primary" },
      { label: "Need help?", href: "/help", kind: "secondary" },
    ],
  };
}

export function resolveTripTimelineSteps(input: {
  bookingStatus: ShortletBookingStatus | string | null | undefined;
  paymentStatus: ShortletPaymentStatus | string | null;
  bookingMode: "request" | "instant";
  checkIn: string;
  checkOut: string;
  nowIso?: string;
}): {
  current: TripTimelineStep;
  steps: TripTimelineStepState[];
  helperTitle: string;
  helperBody: string;
  nextActions: TripTimelineAction[];
} {
  const now = parseDate(input.nowIso) ?? new Date();
  const bookingStatus = normalizeShortletBookingStatus(input.bookingStatus);
  const paymentStatus = normalizeShortletPaymentStatus(input.paymentStatus);
  const current = resolveCurrentStep({
    bookingStatus,
    paymentStatus,
    bookingMode: input.bookingMode,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    now,
  });

  const flow = input.bookingMode === "instant" ? INSTANT_FLOW : REQUEST_FLOW;
  const currentIndex = resolveFlowIndex(flow, current);
  const terminalAnchor = resolveAnchorStep(current, input.bookingMode);
  const anchorIndex = terminalAnchor ? resolveFlowIndex(flow, terminalAnchor) : -1;
  const progressIndex = currentIndex >= 0 ? currentIndex : anchorIndex;

  const baseSteps: TripTimelineStepState[] = flow.map((step, index) => {
    if (currentIndex >= 0) {
      if (index < currentIndex) {
        return { key: step, label: labelForStep(step), status: "done" };
      }
      if (index === currentIndex) {
        return { key: step, label: labelForStep(step), status: "current" };
      }
      return { key: step, label: labelForStep(step), status: "todo" };
    }

    if (progressIndex >= 0 && index <= progressIndex) {
      return { key: step, label: labelForStep(step), status: "done" };
    }
    return { key: step, label: labelForStep(step), status: "todo" };
  });

  const steps: TripTimelineStepState[] =
    currentIndex >= 0
      ? baseSteps
      : [
          ...baseSteps,
          {
            key: current,
            label: labelForStep(current),
            status: "current",
          },
        ];

  const helper = helperCopyForStep(current);
  return {
    current,
    steps,
    helperTitle: helper.helperTitle,
    helperBody: helper.helperBody,
    nextActions: helper.nextActions,
  };
}

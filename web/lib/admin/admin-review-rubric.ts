import { ADMIN_REVIEW_COPY } from "./admin-review-microcopy";

export type ReviewReasonCode =
  | "needs_location"
  | "adjust_pin"
  | "needs_photos"
  | "needs_cover"
  | "weak_cover"
  | "video_issue"
  | "improve_copy"
  | "pricing_issue";

export type StructuredRejection =
  | {
      type: "admin_review_request_changes";
      reasons: ReviewReasonCode[];
      message: string;
      reviewed_at?: string;
      reviewed_by?: string | null;
    }
  | {
      type: "legacy";
      reasons: ReviewReasonCode[];
      message: string;
    };

export const REVIEW_REASONS: { code: ReviewReasonCode; label: string }[] = [
  { code: "needs_location", label: ADMIN_REVIEW_COPY.reasons.needs_location },
  { code: "adjust_pin", label: ADMIN_REVIEW_COPY.reasons.adjust_pin },
  { code: "needs_photos", label: ADMIN_REVIEW_COPY.reasons.needs_photos },
  { code: "needs_cover", label: ADMIN_REVIEW_COPY.reasons.needs_cover },
  { code: "weak_cover", label: ADMIN_REVIEW_COPY.reasons.weak_cover },
  { code: "video_issue", label: ADMIN_REVIEW_COPY.reasons.video_issue },
  { code: "improve_copy", label: ADMIN_REVIEW_COPY.reasons.improve_copy },
  { code: "pricing_issue", label: ADMIN_REVIEW_COPY.reasons.pricing_issue },
];

export function normalizeReasons(input: unknown): ReviewReasonCode[] {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(REVIEW_REASONS.map((r) => r.code));
  return input.filter((code): code is ReviewReasonCode => allowed.has(code as ReviewReasonCode));
}

export function buildRequestChangesMessage(reasons: ReviewReasonCode[]): string {
  if (!reasons.length) {
    return "Thanks for submitting your listing. Please make the requested updates and resubmit for approval.";
  }
  const reasonLabels = REVIEW_REASONS.filter((r) => reasons.includes(r.code)).map((r) => `• ${r.label}`);
  return [
    "Thanks for submitting your listing. Could you update these items:",
    ...reasonLabels,
    "After you’ve made these changes, resubmit for approval. Thank you!",
  ].join("\n");
}

export function validateRequestChangesPayload(reasons: ReviewReasonCode[], message: string | undefined) {
  const finalMessage = (message || "").trim();
  if (!reasons.length && !finalMessage) {
    return { ok: false as const, error: "At least one reason or message is required." };
  }
  return { ok: true as const, message: finalMessage || buildRequestChangesMessage(reasons) };
}

export function parseRejectionReason(raw: string | null | undefined): StructuredRejection {
  if (!raw) return { type: "legacy", reasons: [], message: "" };
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.type === "admin_review_request_changes") {
      return {
        type: "admin_review_request_changes",
        reasons: normalizeReasons(parsed.reasons),
        message: typeof parsed.message === "string" ? parsed.message : "",
        reviewed_at: typeof parsed.reviewed_at === "string" ? parsed.reviewed_at : undefined,
        reviewed_by: typeof parsed.reviewed_by === "string" ? parsed.reviewed_by : undefined,
      };
    }
  } catch {
    // fall through to legacy
  }
  return { type: "legacy", reasons: [], message: raw };
}

export function serializeRequestChangesPayload(
  reasons: ReviewReasonCode[],
  message: string,
  reviewerId: string | null | undefined
) {
  const payload: StructuredRejection = {
    type: "admin_review_request_changes",
    reasons,
    message,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewerId ?? undefined,
  };
  return JSON.stringify(payload);
}

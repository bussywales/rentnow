import { HOST_FIX_REQUEST_COPY, type HostFixReasonCode } from "./host-fix-request-microcopy";
import { type ReviewReasonCode, parseRejectionReason as parseAdminRejection } from "@/lib/admin/admin-review-rubric";

export type FixActionKind = "photos" | "location" | "video" | "details";

export type FixRequestItem = {
  code: HostFixReasonCode | "fallback";
  label: string;
  action: { kind: FixActionKind; href: string };
};

export type ParsedFixRequest = {
  reasons: ReviewReasonCode[];
  message: string | null;
  isStructured: boolean;
};

export function parseRejectionReason(raw: unknown): ParsedFixRequest {
  if (typeof raw !== "string") return { reasons: [], message: null, isStructured: false };
  const structured = parseAdminRejection(raw);
  if (structured.type === "admin_review_request_changes") {
    return {
      reasons: structured.reasons,
      message: structured.message || null,
      isStructured: true,
    };
  }
  return { reasons: [], message: structured.message || raw || null, isStructured: false };
}

function resolveAction(kind: FixActionKind): { kind: FixActionKind; href: string } {
  switch (kind) {
    case "photos":
      return { kind, href: "?step=photos" };
    case "location":
      return { kind, href: "?focus=location" };
    case "video":
      return { kind, href: "?step=photos" };
    default:
      return { kind: "details", href: "" };
  }
}

export function mapReasonToItem(code: ReviewReasonCode): FixRequestItem {
  const map: Partial<Record<ReviewReasonCode, { code: HostFixReasonCode; action: FixActionKind }>> = {
    needs_location: { code: "needs_location", action: "location" },
    adjust_pin: { code: "adjust_pin", action: "location" },
    needs_photos: { code: "needs_photos", action: "photos" },
    needs_cover: { code: "needs_cover", action: "photos" },
    weak_cover: { code: "weak_cover", action: "photos" },
    video_issue: { code: "video_issue", action: "video" },
    improve_copy: { code: "improve_copy", action: "details" },
    pricing_issue: { code: "pricing_issue", action: "details" },
  };
  const mapped = map[code];
  if (mapped) {
    return {
      code: mapped.code,
      label: HOST_FIX_REQUEST_COPY.reasons[mapped.code],
      action: resolveAction(mapped.action),
    };
  }
  return {
    code: "fallback",
    label: HOST_FIX_REQUEST_COPY.reasons.fallback,
    action: resolveAction("details"),
  };
}

export function buildFixRequestItems(reasons: ReviewReasonCode[]): FixRequestItem[] {
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return [mapReasonToItem("improve_copy")];
  }
  return reasons.map((code) => mapReasonToItem(code));
}

export function buildDismissKey(listingId: string, payload: ParsedFixRequest): string {
  const serialized = JSON.stringify({ id: listingId, reasons: payload.reasons, message: payload.message || "" });
  try {
    return `host.fix.request.dismiss.${typeof window !== "undefined" ? window.btoa(serialized) : serialized}`;
  } catch {
    return `host.fix.request.dismiss.${serialized}`;
  }
}

export function shouldShowFixRequestPanel(status: string | null | undefined, dismissed: boolean) {
  if (!status || status !== "changes_requested") return false;
  return !dismissed;
}

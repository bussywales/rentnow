import {
  normalizeShortletBookingStatus,
  type ShortletBookingStatus,
} from "@/lib/shortlet/return-status";

type RealtimeBookingRow = {
  status?: string | null;
};

export type ShortletBookingRealtimePayload = {
  old?: RealtimeBookingRow | null;
  new?: RealtimeBookingRow | null;
};

export function resolveRealtimeBookingStatusUpdate(
  payload: ShortletBookingRealtimePayload
): ShortletBookingStatus | null {
  const previous = normalizeShortletBookingStatus(payload.old?.status);
  const next = normalizeShortletBookingStatus(payload.new?.status);
  if (!next) return null;
  if (previous === next) return null;
  return next;
}

import type { UserRole } from "@/lib/types";

export function canHostManageShortletBooking(input: {
  actorRole: UserRole | null | undefined;
  actorUserId: string;
  hostUserId: string;
  hasDelegation?: boolean;
}): boolean {
  if (input.actorRole === "admin") return true;
  if (!input.actorUserId || !input.hostUserId) return false;
  if (input.actorUserId === input.hostUserId) return true;
  return input.actorRole === "agent" && !!input.hasDelegation;
}

export function canViewTenantShortletBookings(role: UserRole | null | undefined): boolean {
  return role === "tenant";
}

export function classifyShortletBookingWindow(input: {
  status: string | null | undefined;
  checkIn: string | null | undefined;
  checkOut: string | null | undefined;
  now?: Date;
}): "incoming" | "upcoming" | "past" | "other" {
  const normalizedStatus = String(input.status || "").toLowerCase();
  const now = input.now ?? new Date();
  const checkInMs = Date.parse(String(input.checkIn || ""));
  const checkOutMs = Date.parse(String(input.checkOut || ""));

  if (!Number.isFinite(checkInMs) || !Number.isFinite(checkOutMs)) return "other";

  if (normalizedStatus === "pending") return "incoming";
  if (normalizedStatus === "confirmed" || normalizedStatus === "completed") {
    if (checkOutMs < now.getTime()) return "past";
    return "upcoming";
  }
  if (
    normalizedStatus === "declined" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "expired"
  ) {
    return "past";
  }
  return "other";
}

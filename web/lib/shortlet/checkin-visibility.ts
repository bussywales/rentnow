import type { ShortletBookingStatus, ShortletPaymentStatus } from "@/lib/shortlet/return-status";

export type GuestCheckinVisibilityLevel = "none" | "limited" | "full";

export type ShortletCheckinDetails = {
  checkin_instructions: string | null;
  checkin_window_start: string | null;
  checkin_window_end: string | null;
  checkout_time: string | null;
  access_method: string | null;
  access_code_hint: string | null;
  parking_info: string | null;
  wifi_info: string | null;
  house_rules: string | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  pets_allowed: boolean | null;
  smoking_allowed: boolean | null;
  parties_allowed: boolean | null;
  max_guests_override: number | null;
  emergency_notes: string | null;
};

export function resolveGuestCheckinVisibility(input: {
  bookingStatus: ShortletBookingStatus;
  paymentStatus: ShortletPaymentStatus | null;
}): {
  canShow: boolean;
  level: GuestCheckinVisibilityLevel;
} {
  if (input.paymentStatus !== "succeeded") {
    return { canShow: false, level: "none" };
  }

  if (input.bookingStatus === "pending") {
    return { canShow: true, level: "limited" };
  }

  if (input.bookingStatus === "confirmed" || input.bookingStatus === "completed") {
    return { canShow: true, level: "full" };
  }

  return { canShow: false, level: "none" };
}

export function redactCheckinDetailsForGuest(
  details: ShortletCheckinDetails,
  level: GuestCheckinVisibilityLevel
): ShortletCheckinDetails | null {
  if (level === "none") return null;
  if (level === "full") return details;

  return {
    checkin_instructions: null,
    checkin_window_start: details.checkin_window_start,
    checkin_window_end: details.checkin_window_end,
    checkout_time: details.checkout_time,
    access_method: null,
    access_code_hint: null,
    parking_info: null,
    wifi_info: null,
    house_rules: details.house_rules,
    quiet_hours_start: details.quiet_hours_start,
    quiet_hours_end: details.quiet_hours_end,
    pets_allowed: details.pets_allowed,
    smoking_allowed: details.smoking_allowed,
    parties_allowed: details.parties_allowed,
    max_guests_override: details.max_guests_override,
    emergency_notes: null,
  };
}

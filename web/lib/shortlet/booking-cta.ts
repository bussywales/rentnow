export function resolveShortletBookingCtaLabel(bookingMode: "instant" | "request"): string {
  return bookingMode === "request" ? "Request to book" : "Reserve";
}


function formatMoney(currency: string, amountMinor: number) {
  const amount = Math.max(0, Math.trunc(amountMinor || 0)) / 100;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toFixed(2)}`;
  }
}

type ShortletEmailBase = {
  propertyTitle: string;
  city?: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountMinor: number;
  currency: string;
  bookingId: string;
  siteUrl: string;
};

function renderBaseLines(input: ShortletEmailBase) {
  return `
    <ul style="margin:12px 0 0;padding-left:18px;color:#334155;line-height:1.6">
      <li><strong>Listing:</strong> ${input.propertyTitle}</li>
      <li><strong>City:</strong> ${input.city || "Unknown"}</li>
      <li><strong>Dates:</strong> ${input.checkIn} to ${input.checkOut}</li>
      <li><strong>Nights:</strong> ${input.nights}</li>
      <li><strong>Total:</strong> ${formatMoney(input.currency, input.amountMinor)}</li>
      <li><strong>Booking ID:</strong> ${input.bookingId}</li>
    </ul>
  `;
}

function wrapHtml(title: string, body: string, siteUrl: string) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b">PropatyHub shortlets</p>
      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">${title}</h1>
      ${body}
      <p style="margin:20px 0 0;font-size:12px;color:#64748b">Marketplace notice: always verify listing details before making commitments.</p>
      <p style="margin:6px 0 0;font-size:12px;color:#64748b">Manage your bookings: <a href="${siteUrl}/host" style="color:#0ea5e9">${siteUrl}/host</a></p>
    </div>
  </div>
  `;
}

export function buildGuestBookingPendingEmail(input: ShortletEmailBase) {
  const subject = "Booking request received — PropatyHub";
  const html = wrapHtml(
    "Your shortlet request is pending host approval",
    `<p style="margin:0 0 8px;color:#334155">We received your booking request. The host will review it shortly.</p>${renderBaseLines(
      input
    )}`,
    input.siteUrl
  );
  return { subject, html };
}

export function buildGuestBookingConfirmedEmail(input: ShortletEmailBase) {
  const subject = "Booking confirmed — PropatyHub";
  const html = wrapHtml(
    "Your shortlet booking is confirmed",
    `<p style="margin:0 0 8px;color:#334155">Great news. Your booking is confirmed and reserved.</p>${renderBaseLines(input)}`,
    input.siteUrl
  );
  return { subject, html };
}

export function buildHostBookingRequestEmail(input: ShortletEmailBase) {
  const subject = "New shortlet booking request";
  const html = wrapHtml(
    "A guest requested to book your shortlet",
    `<p style="margin:0 0 8px;color:#334155">Review this booking from your host dashboard.</p>${renderBaseLines(input)}`,
    input.siteUrl
  );
  return { subject, html };
}

export function buildGuestBookingDeclinedEmail(input: ShortletEmailBase) {
  const subject = "Booking request declined";
  const html = wrapHtml(
    "Your shortlet request was declined",
    `<p style="margin:0 0 8px;color:#334155">The host declined this request. If payment was captured, mark refund handling in admin ops.</p>${renderBaseLines(
      input
    )}`,
    input.siteUrl
  );
  return { subject, html };
}

export function buildGuestBookingExpiredEmail(input: ShortletEmailBase) {
  const subject = "Booking request expired";
  const html = wrapHtml(
    "Your shortlet request expired",
    `<p style="margin:0 0 8px;color:#334155">This request was not accepted in time and has expired.</p>${renderBaseLines(
      input
    )}`,
    input.siteUrl
  );
  return { subject, html };
}

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

function renderBaseLines(input: ShortletEmailBase, statusLabel: string) {
  return `
    <ul style="margin:12px 0 0;padding-left:18px;color:#334155;line-height:1.6">
      <li><strong>Listing:</strong> ${input.propertyTitle}</li>
      <li><strong>City:</strong> ${input.city || "Unknown"}</li>
      <li><strong>Dates:</strong> ${input.checkIn} to ${input.checkOut}</li>
      <li><strong>Nights:</strong> ${input.nights}</li>
      <li><strong>Total:</strong> ${formatMoney(input.currency, input.amountMinor)}</li>
      <li><strong>Status:</strong> ${statusLabel}</li>
      <li><strong>Booking ID:</strong> ${input.bookingId}</li>
    </ul>
  `;
}

function renderCta(siteUrl: string, ctaPath: string, ctaLabel: string) {
  return `
    <p style="margin:16px 0 0">
      <a
        href="${siteUrl}${ctaPath}"
        style="display:inline-block;border-radius:10px;background:#0ea5e9;color:#ffffff;padding:10px 14px;text-decoration:none;font-weight:600"
      >
        ${ctaLabel}
      </a>
    </p>
  `;
}

function wrapHtml(
  title: string,
  body: string,
  siteUrl: string,
  ctaPath: string,
  ctaLabel: string
) {
  return `
  <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b">PropatyHub shortlets</p>
      <h1 style="margin:0 0 14px;font-size:22px;line-height:1.25">${title}</h1>
      ${body}
      ${renderCta(siteUrl, ctaPath, ctaLabel)}
      <p style="margin:20px 0 0;font-size:12px;color:#64748b">Marketplace notice: always verify listing details before making commitments.</p>
      <p style="margin:6px 0 0;font-size:12px;color:#64748b">Manage your bookings on PropatyHub.</p>
    </div>
  </div>
  `;
}

export function buildHostNewBookingRequestEmail(input: ShortletEmailBase) {
  const subject = `New booking request: ${input.propertyTitle}`;
  const html = wrapHtml(
    "New booking request",
    `<p style="margin:0 0 8px;color:#334155">A tenant sent a request to book your shortlet.</p>${renderBaseLines(input, "Pending approval")}`,
    input.siteUrl,
    "/host/bookings",
    "Review booking requests"
  );
  return { subject, html };
}

export function buildTenantBookingRequestSentEmail(input: ShortletEmailBase) {
  const subject = "Your booking request was sent";
  const html = wrapHtml(
    "Booking request sent",
    `<p style="margin:0 0 8px;color:#334155">Your request is with the host now. You will get another update after they respond.</p>${renderBaseLines(input, "Pending approval")}`,
    input.siteUrl,
    "/trips",
    "Open my trips"
  );
  return { subject, html };
}

export function buildHostNewReservationEmail(input: ShortletEmailBase) {
  const subject = `New reservation: ${input.propertyTitle}`;
  const html = wrapHtml(
    "New instant reservation",
    `<p style="margin:0 0 8px;color:#334155">A tenant reserved your shortlet in instant mode.</p>${renderBaseLines(input, "Confirmed")}`,
    input.siteUrl,
    "/host/bookings",
    "Open bookings inbox"
  );
  return { subject, html };
}

export function buildTenantReservationConfirmedEmail(input: ShortletEmailBase) {
  const subject = "Reservation confirmed: " + input.propertyTitle;
  const html = wrapHtml(
    "Reservation confirmed",
    `<p style="margin:0 0 8px;color:#334155">Your stay is confirmed and ready.</p>${renderBaseLines(input, "Confirmed")}`,
    input.siteUrl,
    `/trips/${input.bookingId}`,
    "View trip details"
  );
  return { subject, html };
}

export function buildTenantBookingApprovedEmail(input: ShortletEmailBase) {
  const subject = `Booking approved: ${input.propertyTitle}`;
  const html = wrapHtml(
    "Booking approved",
    `<p style="margin:0 0 8px;color:#334155">The host approved your request. Your booking is now confirmed.</p>${renderBaseLines(input, "Confirmed")}`,
    input.siteUrl,
    `/trips/${input.bookingId}`,
    "View trip details"
  );
  return { subject, html };
}

export function buildHostBookingApprovedEmail(input: ShortletEmailBase) {
  const subject = "You approved a booking request";
  const html = wrapHtml(
    "Booking request approved",
    `<p style="margin:0 0 8px;color:#334155">You approved this request and the booking is now confirmed.</p>${renderBaseLines(input, "Confirmed")}`,
    input.siteUrl,
    "/host/bookings",
    "View bookings inbox"
  );
  return { subject, html };
}

export function buildTenantBookingDeclinedEmail(input: ShortletEmailBase) {
  const subject = `Booking declined: ${input.propertyTitle}`;
  const html = wrapHtml(
    "Booking declined",
    `<p style="margin:0 0 8px;color:#334155">The host declined this request. You can browse other shortlets and try new dates.</p>${renderBaseLines(input, "Declined")}`,
    input.siteUrl,
    "/properties?stay=shortlet",
    "Browse shortlets"
  );
  return { subject, html };
}

export function buildTenantBookingExpiredEmail(input: ShortletEmailBase) {
  const subject = `Booking request expired: ${input.propertyTitle}`;
  const html = wrapHtml(
    "Booking request expired",
    `<p style="margin:0 0 8px;color:#334155">This request was not approved in time and has expired.</p>${renderBaseLines(input, "Expired")}`,
    input.siteUrl,
    "/trips",
    "Open my trips"
  );
  return { subject, html };
}

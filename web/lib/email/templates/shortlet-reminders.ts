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

type ReminderTemplateBase = {
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

type ManualCheckinDetailsEmail = ReminderTemplateBase & {
  checkinWindow: string;
  checkoutTime: string;
  accessMethod?: string | null;
  accessHint?: string | null;
  parkingInfo?: string | null;
  wifiInfo?: string | null;
  houseRules?: string | null;
};

function wrapEmail(input: {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
      <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b">PropatyHub shortlets</p>
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${input.title}</h1>
        ${input.body}
        <p style="margin:16px 0 0">
          <a href="${input.ctaHref}" style="display:inline-block;border-radius:10px;background:#0ea5e9;color:#ffffff;padding:10px 14px;text-decoration:none;font-weight:600">
            ${input.ctaLabel}
          </a>
        </p>
      </div>
    </div>
  `;
}

function renderBookingLines(input: ReminderTemplateBase) {
  return `
    <ul style="margin:12px 0 0;padding-left:18px;color:#334155;line-height:1.6">
      <li><strong>Listing:</strong> ${input.propertyTitle}</li>
      <li><strong>City:</strong> ${input.city || "Unknown"}</li>
      <li><strong>Dates:</strong> ${input.checkIn} to ${input.checkOut}</li>
      <li><strong>Nights:</strong> ${input.nights}</li>
      <li><strong>Total:</strong> ${formatMoney(input.currency, input.amountMinor)}</li>
    </ul>
  `;
}

export function buildTenantCheckinReminderEmail(
  input: ReminderTemplateBase & { eventKey: "checkin_48h" | "checkin_24h" | "checkin_3h" }
) {
  const title =
    input.eventKey === "checkin_48h"
      ? "Your check-in is in 48 hours"
      : input.eventKey === "checkin_24h"
        ? "Your check-in is tomorrow"
        : "Your check-in is coming up soon";
  const body = `<p style="margin:0 0 8px;color:#334155">Your shortlet stay is approaching. Review your trip details and get ready for arrival.</p>${renderBookingLines(input)}`;
  return {
    subject: `${title}: ${input.propertyTitle}`,
    html: wrapEmail({
      title,
      body,
      ctaHref: `${input.siteUrl}/trips/${input.bookingId}`,
      ctaLabel: "Open trip details",
    }),
  };
}

export function buildTenantCheckoutReminderEmail(input: ReminderTemplateBase) {
  const title = "Checkout is today";
  const body = `<p style="margin:0 0 8px;color:#334155">Friendly reminder: checkout is scheduled for today. Plan your departure to avoid delays.</p>${renderBookingLines(input)}`;
  return {
    subject: `Checkout reminder: ${input.propertyTitle}`,
    html: wrapEmail({
      title,
      body,
      ctaHref: `${input.siteUrl}/trips/${input.bookingId}`,
      ctaLabel: "Open trip details",
    }),
  };
}

export function buildHostCheckinHeadsUpEmail(input: ReminderTemplateBase) {
  const title = "Guest check-in is tomorrow";
  const body = `<p style="margin:0 0 8px;color:#334155">Heads-up: a guest is due to check in within 24 hours. Confirm arrival readiness and check-in details.</p>${renderBookingLines(input)}`;
  return {
    subject: `Check-in heads-up: ${input.propertyTitle}`,
    html: wrapEmail({
      title,
      body,
      ctaHref: `${input.siteUrl}/host/bookings?booking=${input.bookingId}`,
      ctaLabel: "Open bookings inbox",
    }),
  };
}

export function buildTenantManualCheckinDetailsEmail(input: ManualCheckinDetailsEmail) {
  const title = "Your check-in details are ready";
  const body = `
    <p style="margin:0 0 8px;color:#334155">Your host shared check-in details for this stay.</p>
    ${renderBookingLines(input)}
    <ul style="margin:12px 0 0;padding-left:18px;color:#334155;line-height:1.6">
      <li><strong>Check-in window:</strong> ${input.checkinWindow}</li>
      <li><strong>Checkout time:</strong> ${input.checkoutTime}</li>
      ${input.accessMethod ? `<li><strong>Access:</strong> ${input.accessMethod}</li>` : ""}
      ${input.accessHint ? `<li><strong>Access hint:</strong> ${input.accessHint}</li>` : ""}
      ${input.parkingInfo ? `<li><strong>Parking:</strong> ${input.parkingInfo}</li>` : ""}
      ${input.wifiInfo ? `<li><strong>Wi-Fi:</strong> ${input.wifiInfo}</li>` : ""}
      ${input.houseRules ? `<li><strong>House rules:</strong> ${input.houseRules}</li>` : ""}
    </ul>
  `;
  return {
    subject: `Check-in details shared: ${input.propertyTitle}`,
    html: wrapEmail({
      title,
      body,
      ctaHref: `${input.siteUrl}/trips/${input.bookingId}`,
      ctaLabel: "Open trip details",
    }),
  };
}

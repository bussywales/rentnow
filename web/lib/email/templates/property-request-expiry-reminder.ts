type PropertyRequestExpiryReminderEmailInput = {
  titleLabel: string;
  intentLabel: string;
  marketLabel: string;
  locationLabel: string | null;
  budgetLabel: string | null;
  propertyTypeLabel: string | null;
  bedroomsLabel: string | null;
  expiryLabel: string;
  extendUrl: string;
  manageUrl: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderDetailRow(label: string, value: string | null) {
  if (!value) return "";
  return `<tr><td style="padding:6px 0;font-weight:600;color:#0f172a;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#334155;">${escapeHtml(value)}</td></tr>`;
}

export function buildPropertyRequestExpiryReminderEmail(
  input: PropertyRequestExpiryReminderEmailInput
) {
  const subject = "Your property request expires in 3 days";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;">Property Requests</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;">Your property request is about to expire</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
        ${escapeHtml(input.titleLabel)} will expire on ${escapeHtml(input.expiryLabel)}. Extend it by another 30 days if you still want hosts and agents to respond.
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        ${renderDetailRow("Request", input.titleLabel)}
        ${renderDetailRow("Intent", input.intentLabel)}
        ${renderDetailRow("Market", input.marketLabel)}
        ${renderDetailRow("Location", input.locationLabel)}
        ${renderDetailRow("Budget", input.budgetLabel)}
        ${renderDetailRow("Property type", input.propertyTypeLabel)}
        ${renderDetailRow("Bedrooms", input.bedroomsLabel)}
      </table>
      <p style="margin:0 0 14px;">
        <a href="${escapeHtml(input.extendUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;">
          Extend request
        </a>
      </p>
      <p style="margin:0;">
        <a href="${escapeHtml(input.manageUrl)}" style="color:#0369a1;text-decoration:none;font-weight:600;">
          Review request details
        </a>
      </p>
    </div>
  </body>
</html>`;

  return { subject, html };
}

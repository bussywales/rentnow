type AdminListingReviewEmailInput = {
  listingTitle: string;
  marketLabel: string | null;
  propertyTypeLabel: string | null;
  intentLabel: string | null;
  ownerName: string | null;
  submittedAt: string;
  reviewUrl: string;
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
  return `<tr><td style="padding:6px 0;font-weight:600;color:#0f172a;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#334155;">${escapeHtml(value)}</td></tr>`;
}

export function buildAdminListingReviewEmail(input: AdminListingReviewEmailInput) {
  const subject = "New listing submitted for review";
  const safeTitle = input.listingTitle.trim() || "Untitled listing";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;">Admin review</p>
      <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;">New listing submitted for review</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#475569;">
        A listing has entered the review queue and is ready for admin review.
      </p>
      <div style="margin:0 0 20px;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
        <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">${escapeHtml(safeTitle)}</p>
      </div>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        ${renderDetailRow("Market", input.marketLabel)}
        ${renderDetailRow("Property type", input.propertyTypeLabel)}
        ${renderDetailRow("Intent", input.intentLabel)}
        ${renderDetailRow("Host or agent", input.ownerName)}
        ${renderDetailRow("Submitted at", input.submittedAt)}
      </table>
      <p style="margin:0;">
        <a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;">
          Open review queue item
        </a>
      </p>
      <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#64748b;">
        You can change this email preference from your admin profile settings.
      </p>
    </div>
  </body>
</html>`;

  return { subject, html };
}

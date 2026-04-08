import { getMoveReadyCategoryLabel } from "@/lib/services/move-ready";

export function buildMoveReadyProviderLeadEmail(input: {
  providerBusinessName: string;
  category: string;
  marketCode: string;
  city?: string | null;
  area?: string | null;
  propertyTitle?: string | null;
  preferredTimingText?: string | null;
  contextNotes: string;
  requesterName?: string | null;
  requesterRole: string;
  requesterEmail?: string | null;
  requesterPhone?: string | null;
  contactPreference?: string | null;
  responseUrl: string;
}) {
  const location = [input.area, input.city, input.marketCode].filter(Boolean).join(", ");
  const subject = `${getMoveReadyCategoryLabel(input.category)} lead · ${location || input.marketCode}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h1 style="font-size: 20px; margin-bottom: 12px;">New Move &amp; Ready Services lead</h1>
      <p style="margin: 0 0 12px;">This lead was routed to <strong>${escapeHtml(input.providerBusinessName)}</strong> for a property-prep request.</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tbody>
          ${row("Category", getMoveReadyCategoryLabel(input.category))}
          ${row("Location", location || input.marketCode)}
          ${row("Property", input.propertyTitle || "Not linked")}
          ${row("Timing", input.preferredTimingText || "Flexible")}
          ${row("Requester", input.requesterName || input.requesterRole)}
          ${row("Contact preference", input.contactPreference || "Not specified")}
          ${row("Requester email", input.requesterEmail || "Not provided")}
          ${row("Requester phone", input.requesterPhone || "Not provided")}
        </tbody>
      </table>
      <div style="margin: 16px 0; padding: 14px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0;">
        <p style="margin: 0 0 8px; font-weight: 600;">Request context</p>
        <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(input.contextNotes)}</p>
      </div>
      <p style="margin: 16px 0;">Use the secure response link below to accept or decline and leave a short note for the operator and host.</p>
      <p style="margin: 0 0 18px;">
        <a href="${input.responseUrl}" style="display: inline-block; background: #0284c7; color: white; text-decoration: none; padding: 12px 16px; border-radius: 10px; font-weight: 600;">Open lead response</a>
      </p>
      <p style="margin: 0; font-size: 12px; color: #475569;">This is a lead-routing email only. PropatyHub is not confirming scheduling or collecting payment in this workflow.</p>
    </div>
  `;

  return { subject, html };
}

function row(label: string, value: string) {
  return `<tr><td style="padding: 8px 12px; border: 1px solid #e2e8f0; font-weight: 600; width: 180px;">${escapeHtml(label)}</td><td style="padding: 8px 12px; border: 1px solid #e2e8f0;">${escapeHtml(value)}</td></tr>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

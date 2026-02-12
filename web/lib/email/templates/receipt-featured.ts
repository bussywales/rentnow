import { formatMinor } from "@/lib/payments/products";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildFeaturedReceiptEmail(input: {
  amountMinor: number;
  currency: string;
  plan: "featured_7d" | "featured_30d";
  reference: string;
  paidAtIso: string | null;
  propertyTitle: string;
  propertyAddress: string | null;
  propertyCity: string | null;
  siteUrl: string;
}) {
  const amountLabel = formatMinor(input.currency, input.amountMinor);
  const paidAtLabel = input.paidAtIso
    ? new Date(input.paidAtIso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })
    : new Date().toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
  const planLabel = input.plan === "featured_30d" ? "Featured 30 days" : "Featured 7 days";
  const propertyLine = [input.propertyAddress, input.propertyCity].filter(Boolean).join(", ");
  const dashboardUrl = `${input.siteUrl}/host`;

  const subject = "Payment received — Featured listing on PropatyHub";
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin: 0 0 8px;">PropatyHub receipt</h2>
      <p style="margin: 0 0 16px; color: #334155;">
        Payment received for your featured listing activation.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: #64748b;">Amount</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(amountLabel)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Plan</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(planLabel)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Reference</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(input.reference)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Paid at</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(paidAtLabel)}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Listing</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(input.propertyTitle)}</td></tr>
        ${
          propertyLine
            ? `<tr><td style="padding: 6px 0; color: #64748b;">Location</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(propertyLine)}</td></tr>`
            : ""
        }
      </table>
      <p style="margin: 16px 0 0;">
        <a href="${dashboardUrl}" style="display:inline-block; background:#0ea5e9; color:#fff; text-decoration:none; padding:8px 12px; border-radius:8px; font-weight:600;">
          Open host dashboard
        </a>
      </p>
      <p style="margin: 12px 0 0; color: #64748b; font-size: 12px;">
        PropatyHub is a marketplace. Always verify viewing details before paying.
      </p>
    </div>
  `;

  return { subject, html };
}

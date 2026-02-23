type SupportEscalationEmailInput = {
  requestId: string;
  category: string;
  role: string;
  name: string | null;
  email: string | null;
  message: string;
  metadata: Record<string, unknown>;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMetadata(metadata: Record<string, unknown>) {
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return "{}";
  }
}

export function buildSupportEscalationEmail(input: SupportEscalationEmailInput) {
  const summary = input.message.trim().slice(0, 72) || "Support request";
  const subject = `[Support] ${input.category} - ${input.role} - ${summary}`;
  const metadataText = formatMetadata(input.metadata);

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:0 auto;color:#0f172a;">
      <h2 style="margin:0 0 12px;">Support escalation received</h2>
      <p style="margin:0 0 8px;"><strong>Ticket:</strong> ${escapeHtml(input.requestId)}</p>
      <p style="margin:0 0 8px;"><strong>Category:</strong> ${escapeHtml(input.category)}</p>
      <p style="margin:0 0 8px;"><strong>Role:</strong> ${escapeHtml(input.role)}</p>
      <p style="margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(input.name || "Unknown")}</p>
      <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(input.email || "Unknown")}</p>
      <p style="margin:16px 0 6px;"><strong>Message</strong></p>
      <pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">${escapeHtml(input.message)}</pre>
      <p style="margin:16px 0 6px;"><strong>Metadata</strong></p>
      <pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">${escapeHtml(metadataText)}</pre>
    </div>
  `.trim();

  return { subject, html };
}


type SupportTicketNotificationEmailInput = {
  requestId: string;
  category: string;
  role: string;
  name: string | null;
  email: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
  queueUrl: string;
  escalated: boolean;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMetadata(metadata: Record<string, unknown> | null | undefined) {
  try {
    return JSON.stringify(metadata ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

export function buildSupportTicketNotificationEmail(input: SupportTicketNotificationEmailInput) {
  const summary = input.message.trim().slice(0, 72) || "Support request";
  const subjectPrefix = input.escalated ? "[SUPPORT ESCALATION]" : "[Support request]";
  const subject = `${subjectPrefix} ${input.category} - ${summary}`;
  const metadataText = formatMetadata(input.metadata);
  const heading = input.escalated ? "Escalated support request" : "New support request";
  const summaryLine = input.escalated
    ? "This ticket was escalated from the Help widget or Ask Assistant flow and should be triaged promptly."
    : "This request was submitted through the Help and Support contact flow.";

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:0 auto;color:#0f172a;">
      <h2 style="margin:0 0 12px;">${escapeHtml(heading)}</h2>
      <p style="margin:0 0 10px;display:inline-block;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:700;letter-spacing:0.04em;background:${input.escalated ? "#fef3c7" : "#e2e8f0"};color:${input.escalated ? "#92400e" : "#334155"};">${escapeHtml(input.escalated ? "Escalated" : "Standard")}</p>
      <p style="margin:0 0 16px;color:#475569;">${escapeHtml(summaryLine)}</p>
      <p style="margin:0 0 8px;"><strong>Ticket:</strong> ${escapeHtml(input.requestId)}</p>
      <p style="margin:0 0 8px;"><strong>Category:</strong> ${escapeHtml(input.category)}</p>
      <p style="margin:0 0 8px;"><strong>Role:</strong> ${escapeHtml(input.role)}</p>
      <p style="margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(input.name || "Unknown")}</p>
      <p style="margin:0 0 8px;"><strong>Email:</strong> ${escapeHtml(input.email || "Unknown")}</p>
      <p style="margin:16px 0 6px;"><strong>Message</strong></p>
      <pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">${escapeHtml(input.message)}</pre>
      <p style="margin:16px 0 6px;"><strong>Metadata</strong></p>
      <pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px;">${escapeHtml(metadataText)}</pre>
      <p style="margin:16px 0 0;">
        <a href="${escapeHtml(input.queueUrl)}" style="display:inline-block;border-radius:10px;background:#0f172a;color:#fff;padding:10px 14px;text-decoration:none;font-weight:600;">
          Open support queue
        </a>
      </p>
    </div>
  `.trim();

  return { subject, html };
}

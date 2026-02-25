type SupportReplyEmailInput = {
  requestId: string;
  recipientName: string | null;
  subject: string;
  body: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatBodyHtml(text: string) {
  return escapeHtml(text).replaceAll("\n", "<br />");
}

export function buildSupportReplyEmail(input: SupportReplyEmailInput) {
  const safeSubject = input.subject.trim();
  const safeBody = input.body.trim();
  const safeRecipientName = (input.recipientName || "").trim() || "there";

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:680px;margin:0 auto;color:#0f172a;">
      <p style="margin:0 0 10px;">Hi ${escapeHtml(safeRecipientName)},</p>
      <div style="line-height:1.6;margin:0 0 14px;">${formatBodyHtml(safeBody)}</div>
      <p style="margin:16px 0 6px;color:#475569;font-size:13px;">Reference: ${escapeHtml(input.requestId)}</p>
      <p style="margin:0;color:#475569;font-size:13px;">PropatyHub Support</p>
    </div>
  `.trim();

  return {
    subject: safeSubject,
    html,
  };
}

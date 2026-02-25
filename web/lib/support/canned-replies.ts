export type SupportCannedReplyTemplateId =
  | "received_request"
  | "need_more_details"
  | "resolved_next_steps"
  | "refund_billing_guidance"
  | "safety_escalation_guidance";

export type SupportCannedReplyTemplate = {
  id: SupportCannedReplyTemplateId;
  label: string;
  subject: string;
  body: string;
};

type PlaceholderInput = {
  ticketId?: string | null;
  requesterName?: string | null;
};

const PLACEHOLDER_FALLBACKS = {
  ticketId: "your request",
  requesterName: "there",
} as const;

export const SUPPORT_CANNED_REPLIES: ReadonlyArray<SupportCannedReplyTemplate> = Object.freeze([
  {
    id: "received_request",
    label: "We've received your request",
    subject: "We've received {{ticketId}}",
    body: `Hi {{requesterName}},

Thanks for contacting PropatyHub Support. We’ve received {{ticketId}} and our team is reviewing it now.

We’ll share the next update as soon as possible.

Best,
PropatyHub Support`,
  },
  {
    id: "need_more_details",
    label: "Need more details",
    subject: "More details needed for {{ticketId}}",
    body: `Hi {{requesterName}},

We’re reviewing {{ticketId}} and need a few more details to move quickly:
- exact time the issue happened
- the page or listing link involved
- any screenshot or error text you saw

Reply to this email with the details and we’ll continue right away.

Best,
PropatyHub Support`,
  },
  {
    id: "resolved_next_steps",
    label: "Resolved / next steps",
    subject: "Update on {{ticketId}}",
    body: `Hi {{requesterName}},

Your request {{ticketId}} has been resolved on our side.

If you still see the issue, reply with the latest screenshot and current page URL and we’ll reopen it immediately.

Best,
PropatyHub Support`,
  },
  {
    id: "refund_billing_guidance",
    label: "Refund / billing guidance",
    subject: "Billing guidance for {{ticketId}}",
    body: `Hi {{requesterName}},

Thanks for raising this billing concern for {{ticketId}}.

We’ve shared your case with our billing team. We’ll update you with the outcome and next steps as soon as review is complete.

Best,
PropatyHub Support`,
  },
  {
    id: "safety_escalation_guidance",
    label: "Safety escalation guidance",
    subject: "Safety update for {{ticketId}}",
    body: `Hi {{requesterName}},

We’ve escalated {{ticketId}} to our safety team.

If there is an immediate risk, please contact local emergency services first. Our team will continue support and follow up directly.

Best,
PropatyHub Support`,
  },
]);

export function getSupportCannedReplyTemplate(id: string | null | undefined) {
  if (!id) return null;
  return SUPPORT_CANNED_REPLIES.find((template) => template.id === id) ?? null;
}

function applyPlaceholders(value: string, input: PlaceholderInput) {
  const ticketId = (input.ticketId || "").trim() || PLACEHOLDER_FALLBACKS.ticketId;
  const requesterName = (input.requesterName || "").trim() || PLACEHOLDER_FALLBACKS.requesterName;
  return value
    .replaceAll("{{ticketId}}", ticketId)
    .replaceAll("{{requesterName}}", requesterName);
}

export function buildSupportCannedReplyDraft(input: {
  templateId: SupportCannedReplyTemplateId;
  ticketId?: string | null;
  requesterName?: string | null;
}) {
  const template = getSupportCannedReplyTemplate(input.templateId);
  if (!template) return null;
  return {
    id: template.id,
    label: template.label,
    subject: applyPlaceholders(template.subject, input),
    body: applyPlaceholders(template.body, input),
  };
}

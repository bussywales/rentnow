export const LEAD_INTENTS = ["BUY", "MAKE_OFFER", "ASK_QUESTION"] as const;
export type LeadIntent = (typeof LEAD_INTENTS)[number];

export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "CLOSED"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_FINANCING = ["CASH", "MORTGAGE", "UNDECIDED"] as const;
export type LeadFinancing = (typeof LEAD_FINANCING)[number];

export const LEAD_TIMELINES = ["ASAP", "1_3_MONTHS", "3_6_MONTHS", "6_PLUS_MONTHS"] as const;
export type LeadTimeline = (typeof LEAD_TIMELINES)[number];

export type LeadRow = {
  id: string;
  property_id: string;
  owner_id: string;
  buyer_id: string;
  thread_id?: string | null;
  status: LeadStatus;
  intent: LeadIntent;
  budget_min?: number | null;
  budget_max?: number | null;
  financing_status?: LeadFinancing | null;
  timeline?: LeadTimeline | null;
  message: string;
  message_original?: string | null;
  contact_exchange_flags?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

export function normalizeLeadStatus(value: string | null | undefined): LeadStatus {
  const normalized = (value || "").toUpperCase();
  if (LEAD_STATUSES.includes(normalized as LeadStatus)) {
    return normalized as LeadStatus;
  }
  return "NEW";
}

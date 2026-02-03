export type SupportCategory = "general" | "account" | "listing" | "safety" | "billing";

export type SupportTopicTile = {
  id: string;
  title: string;
  description: string;
  icon: "account" | "viewings" | "listing" | "payments" | "safety" | "other";
  category: SupportCategory;
  faqId?: string;
  helperText?: string;
};

export type SupportFaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const SUPPORT_CATEGORY_OPTIONS: Array<{ value: SupportCategory; label: string }> = [
  { value: "general", label: "Other" },
  { value: "account", label: "Account" },
  { value: "listing", label: "Listings & viewings" },
  { value: "billing", label: "Payments & billing" },
  { value: "safety", label: "Safety" },
];

export const SUPPORT_CATEGORY_HELP: Record<SupportCategory, string> = {
  general: "Share a quick summary and we will guide you from there.",
  account: "Tell us the email on your account and what you want to fix.",
  listing: "Include the listing link or ID so we can investigate faster.",
  safety: "Let us know what happened and we will guide next steps.",
  billing: "Include the plan or receipt details if available.",
};

export const SUPPORT_TOPIC_TILES: SupportTopicTile[] = [
  {
    id: "account",
    title: "Account",
    description: "Login issues, profile updates, or verification.",
    icon: "account",
    category: "account",
    faqId: "reset-password",
  },
  {
    id: "viewings",
    title: "Booking & viewings",
    description: "Request, reschedule, or cancel a viewing.",
    icon: "viewings",
    category: "listing",
    faqId: "viewing-request",
  },
  {
    id: "listings",
    title: "Listings",
    description: "Report incorrect details or missing listings.",
    icon: "listing",
    category: "listing",
    faqId: "report-listing",
  },
  {
    id: "payments",
    title: "Payments",
    description: "Billing questions, refunds, or plan changes.",
    icon: "payments",
    category: "billing",
    faqId: "payments",
  },
  {
    id: "safety",
    title: "Safety",
    description: "Scam concerns or urgent safety issues.",
    icon: "safety",
    category: "safety",
    faqId: "safety-guidance",
  },
  {
    id: "other",
    title: "Other",
    description: "Anything else we can help with.",
    icon: "other",
    category: "general",
    faqId: "response-time",
  },
];

export const SUPPORT_FAQ_ITEMS: SupportFaqItem[] = [
  {
    id: "viewing-request",
    question: "How do I request a viewing?",
    answer:
      "Open the listing and choose Request viewing. Pick a time window and submit.",
  },
  {
    id: "viewing-change",
    question: "Can I reschedule or cancel a viewing?",
    answer:
      "Yes. Update the request in your dashboard or message support with your new times.",
  },
  {
    id: "contact-host",
    question: "How do I contact a host?",
    answer:
      "Use the in-app Contact host button so your messages stay secure and tracked.",
  },
  {
    id: "report-listing",
    question: "How do I report a listing?",
    answer:
      "Send the listing link and what looks wrong. We review reports quickly.",
  },
  {
    id: "listing-disappeared",
    question: "Why did a listing disappear?",
    answer:
      "Listings can expire, be paused by the host, or be removed if they break policies.",
  },
  {
    id: "payments",
    question: "How do payments work?",
    answer:
      "Payments and billing details appear in-app. Never pay outside the platform.",
  },
  {
    id: "saved-searches",
    question: "How do saved searches work?",
    answer:
      "Saved searches watch your filters and notify you when new homes match.",
  },
  {
    id: "safety-guidance",
    question: "What are key safety tips?",
    answer:
      "Avoid cash deposits, keep communication in-app, and report anything suspicious.",
  },
  {
    id: "reset-password",
    question: "How do I reset my password?",
    answer:
      "Use Forgot password on the login screen. If the email does not arrive, contact support.",
  },
];

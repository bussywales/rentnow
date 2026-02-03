export type SupportCategory = "general" | "account" | "listing" | "safety" | "billing";

export type SupportTopicTile = {
  id: string;
  title: string;
  description: string;
  icon: "account" | "saved" | "contact" | "report" | "safety" | "other";
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
  { value: "general", label: "General help" },
  { value: "account", label: "Account & login" },
  { value: "listing", label: "Listing & reporting" },
  { value: "safety", label: "Safety & scams" },
  { value: "billing", label: "Billing & plans" },
];

export const SUPPORT_CATEGORY_HELP: Record<SupportCategory, string> = {
  general: "Tell us the basics and we'll point you to the right answer.",
  account: "Share the email on the account and what you're trying to fix.",
  listing: "Include the listing link or ID so we can investigate quickly.",
  safety: "Let us know what happened and we'll guide next steps.",
  billing: "Include your plan tier and any receipt details if available.",
};

export const SUPPORT_TOPIC_TILES: SupportTopicTile[] = [
  {
    id: "account-login",
    title: "Account & login",
    description: "Reset passwords, update email, or verify your profile.",
    icon: "account",
    category: "account",
    faqId: "reset-password",
    helperText: "We can help with access issues and account recovery.",
  },
  {
    id: "saved-alerts",
    title: "Saved & alerts",
    description: "Manage saved searches, alerts, and matching notifications.",
    icon: "saved",
    category: "general",
    faqId: "saved-searches",
    helperText: "Let us know which saved search or alert you need help with.",
  },
  {
    id: "contact-hosts",
    title: "Contacting hosts",
    description: "Reach a host safely using in-app messaging.",
    icon: "contact",
    category: "listing",
    faqId: "contact-host",
    helperText: "Share the listing you're trying to contact a host about.",
  },
  {
    id: "report-listing",
    title: "Report a listing",
    description: "Flag inaccurate details or duplicate listings.",
    icon: "report",
    category: "listing",
    faqId: "report-listing",
    helperText: "Add the listing link or ID so we can review quickly.",
  },
  {
    id: "safety-scams",
    title: "Safety & scams",
    description: "Get help if something feels off.",
    icon: "safety",
    category: "safety",
    faqId: "safety-guidance",
    helperText: "We'll help you stay safe and take the right next step.",
  },
  {
    id: "other",
    title: "Other",
    description: "Anything else we can help with.",
    icon: "other",
    category: "general",
    faqId: "response-time",
    helperText: "Share a quick summary and we'll take it from there.",
  },
];

export const SUPPORT_FAQ_ITEMS: SupportFaqItem[] = [
  {
    id: "contact-host",
    question: "How do I contact a host?",
    answer:
      "Open the listing and use the Contact host button so your messages stay secure and in-app.",
  },
  {
    id: "report-listing",
    question: "How do I report a listing?",
    answer:
      "Send the listing link and what looks wrong. We review reports quickly and follow up if needed.",
  },
  {
    id: "listing-disappeared",
    question: "Why did a listing disappear?",
    answer:
      "Listings can expire, be paused by the host, or be removed if they don't meet our standards.",
  },
  {
    id: "reset-password",
    question: "How do I reset my password?",
    answer:
      "Use 'Forgot password' on the login page. If the email doesn't arrive, contact support and we'll assist.",
  },
  {
    id: "saved-searches",
    question: "How do saved searches work?",
    answer:
      "Saved searches watch your filters and alert you when new homes match.",
  },
  {
    id: "safety-guidance",
    question: "What are key safety tips?",
    answer:
      "Never pay outside the platform and avoid cash deposits before a verified viewing.",
  },
  {
    id: "viewing-change",
    question: "Can I change or cancel a viewing?",
    answer:
      "Update the viewing request if available, or message support with your preferred times.",
  },
  {
    id: "response-time",
    question: "How soon will I hear back?",
    answer: "Most requests receive a response within 24 hours on business days.",
  },
  {
    id: "account-details",
    question: "Can I update my account details?",
    answer:
      "Yes. Update your profile details from your dashboard, or ask support for help.",
  },
];

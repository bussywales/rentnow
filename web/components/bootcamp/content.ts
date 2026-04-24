export const BOOTCAMP_PRIMARY_CTA_HREF =
  "/support?category=general&message=I%27m%20interested%20in%20the%20PropatyHub%20Property%20Opportunity%20Bootcamp%20pilot%20cohort.%20Please%20share%20next%20steps.#support-form";
export const BOOTCAMP_PRICING_CTA_HREF =
  "/support?category=general&message=I%27d%20like%20pricing%20details%20for%20the%20PropatyHub%20Property%20Opportunity%20Bootcamp.#support-form";
export const BOOTCAMP_SECONDARY_CTA_HREF = "#programme-overview";
export const BOOTCAMP_CONTACT_HREF = "mailto:support@propatyhub.com?subject=PropatyHub%20Property%20Opportunity%20Bootcamp";

export const BOOTCAMP_NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Bootcamp", href: "#hero" },
  { label: "Pricing", href: BOOTCAMP_PRICING_CTA_HREF },
  { label: "Resources", href: BOOTCAMP_SECONDARY_CTA_HREF },
  { label: "Contact", href: BOOTCAMP_CONTACT_HREF },
] as const;

export const BOOTCAMP_HERO = {
  headline: "Practical Pathways Into Property Opportunity",
  subheadline:
    "A 5-day digital bootcamp providing clarity, connections, and practical steps to help students, workers, aspiring agents, and future property participants access the property economy with confidence and a clear plan.",
  primaryCta: "Secure Your Spot",
  secondaryCta: "View Programme Roadmap",
  trustStrip: [
    "Practical focus, not hype",
    "Structured 5-day journey",
    "Backed by PropatyHub",
  ],
} as const;

export const BOOTCAMP_WHY_THIS_EXISTS = {
  label: "Why This Exists",
  heading: "Bridging the Gap to Real Property Participation",
  body:
    "Many people want to enter the property market but face barriers such as confusion, limited practical guidance, and hidden processes. This bootcamp is designed to provide practical tools, industry insight, and clear next steps that help participants move from interest to action through the PropatyHub platform.",
} as const;

export const BOOTCAMP_AUDIENCE = [
  {
    title: "Students",
    copy:
      "Early-stage participants looking for practical exposure, side-income pathways, and property-sector awareness.",
  },
  {
    title: "Workers and Professionals",
    copy:
      "People seeking realistic, lower-barrier entry points into property activity alongside work or career development.",
  },
  {
    title: "Aspiring Agents",
    copy:
      "Participants interested in rental sourcing, listings, client support, and property-related opportunity pathways.",
  },
  {
    title: "Future Property Connectors / Lower-Barrier Entry Seekers",
    copy:
      "People looking for structured, practical ways to participate in property without needing to begin as landlords or major investors.",
  },
] as const;

export const BOOTCAMP_OVERVIEW = {
  heading: "5-Day Bootcamp Overview",
  subheading: "Your 5-Day Practical Journey",
  days: [
    {
      day: "Day 1",
      title: "Understanding the New Property Economy",
      copy: "Market realities, entry pathways, and participant mindset.",
    },
    {
      day: "Day 2",
      title: "Student and Rental Demand Opportunities",
      copy: "How to identify practical service-based opportunities in rental markets.",
    },
    {
      day: "Day 3",
      title: "Short-Let and Rent-to-Host Models",
      copy: "Understanding the model, the numbers, and the operational realities.",
    },
    {
      day: "Day 4",
      title: "Collective Entry and Group-Based Wealth Building",
      copy: "How structured collaboration can support long-term property participation.",
    },
    {
      day: "Day 5",
      title: "Visibility, Listings, and Deal Flow with PropatyHub",
      copy: "Turning learning into action through platform usage and market visibility.",
    },
  ],
} as const;

export const BOOTCAMP_HOW_IT_WORKS = {
  heading: "How the Programme Works",
  subheading: "Structured for Action and Follow-Through",
  items: [
    {
      title: "Structured 5-Day Journey",
      copy:
        "A guided five-day experience built around practical learning, clarity, and progressive action.",
    },
    {
      title: "Practical Frameworks",
      copy:
        "Checklists, tools, planning prompts, and structured insight designed to support real next steps.",
    },
    {
      title: "PropatyHub Activation",
      copy:
        "A direct pathway from learning into platform usage, onboarding, listings, and continued follow-through.",
    },
  ],
} as const;

export const BOOTCAMP_ATTENDEE_VALUE = {
  heading: "What Attendees Receive",
  subheading: "Tangible Value and Next-Step Incentives",
  items: [
    {
      title: "Free PropatyHub Listing Credits",
      copy: "Listing credits available for a limited post-programme period.",
    },
    {
      title: "Practical Starter Toolkit",
      copy:
        "Checklists, planning tools, frameworks, and action resources to support implementation.",
    },
    {
      title: "Accountability and Community Access",
      copy:
        "A supportive environment for follow-through, discussion, and continued momentum.",
    },
    {
      title: "Simple Onboarding Pathway",
      copy: "A straightforward route into PropatyHub after the programme.",
    },
  ],
} as const;

export const BOOTCAMP_WHY_PROPATYHUB = {
  heading: "Why PropatyHub",
  subheading: "Why PropatyHub Is Your Trusted Partner",
  points: [
    {
      title: "Platform Relevance",
      copy: "Direct access to real property discovery, visibility, and useful tools.",
    },
    {
      title: "Trust Advantage",
      copy: "A credible platform guiding participants more effectively than hype-led seminars.",
    },
    {
      title: "Action Pathway",
      copy: "A clear route from learning into practical platform use and next-step action.",
    },
    {
      title: "Community and Growth",
      copy: "Longer-term participation within a supportive and practical ecosystem.",
    },
  ],
} as const;

export const BOOTCAMP_FAQS = [
  {
    id: "who-is-it-for",
    question: "Who is this bootcamp for?",
    answer:
      "It is for students, workers, aspiring agents, and anyone looking for practical, lower-barrier pathways into property participation.",
  },
  {
    id: "need-experience",
    question: "Do I need property experience to join?",
    answer:
      "No. The programme is designed for a range of starting points and does not require prior property experience.",
  },
  {
    id: "only-buying-property",
    question: "Is this focused only on buying property?",
    answer:
      "No. The bootcamp explores broader entry routes including rental demand opportunities, short-let models, group-based pathways, visibility, and platform-led action.",
  },
  {
    id: "after-programme",
    question: "What happens after the programme ends?",
    answer:
      "Attendees receive next-step resources, limited-period listing credits, onboarding guidance, and access to a community or accountability environment for follow-through.",
  },
  {
    id: "how-propatyhub-fits",
    question: "How does PropatyHub fit into the experience?",
    answer:
      "PropatyHub connects the learning experience to practical action through visibility, listings, onboarding, and continued ecosystem participation.",
  },
] as const;

export const BOOTCAMP_FINAL_CTA = {
  heading: "Start With Practical Guidance, Not Hype",
  copy:
    "Take the first step into structured property opportunity with a practical programme designed to move you from interest to action.",
  primaryCta: "Join the Pilot Cohort",
  secondaryCta: "View Programme Roadmap",
} as const;

export const BOOTCAMP_FOOTER = {
  brand: "PropatyHub",
  links: [
    { label: "Privacy Policy", href: "/legal" },
    { label: "Terms of Service", href: "/legal/disclaimer" },
    { label: "Contact", href: BOOTCAMP_CONTACT_HREF },
  ],
  copyright: "© 2024 PropatyHub. All rights reserved.",
} as const;

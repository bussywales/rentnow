import type { MobileQuickSearchCategory } from "@/lib/home/mobile-quicksearch-presets";

export const MOBILE_FEATURED_DISCOVERY_MARKETS = ["GLOBAL", "NG", "GB", "CA"] as const;

export type MobileFeaturedDiscoveryMarket = (typeof MOBILE_FEATURED_DISCOVERY_MARKETS)[number];

export type MobileFeaturedDiscoveryCatalogueItem = {
  // Stable identifier used by tests and deterministic rotation.
  id: string;
  title: string;
  subtitle: string;
  category: MobileQuickSearchCategory;
  city?: string;
  shortletParams?: Record<string, string>;
  tag: string;
  // "GLOBAL" makes an item eligible for every market as fallback.
  marketTags: MobileFeaturedDiscoveryMarket[];
  // Higher priority shows earlier before rotation.
  priority?: number;
  // Optional visual mapping key reserved for future image variants.
  imageKey?: string;
  // Optional static lifecycle controls for campaign-like cards.
  disabled?: boolean;
  validFrom?: string;
  validTo?: string;
};

export const MOBILE_FEATURED_DISCOVERY_CATALOGUE: ReadonlyArray<MobileFeaturedDiscoveryCatalogueItem> = [
  {
    id: "global-flexible-shortlets",
    title: "Flexible shortlets for city breaks",
    subtitle: "Fast, reliable stays for work and weekend plans.",
    category: "shortlet",
    shortletParams: { guests: "2", sort: "recommended" },
    tag: "Shortlets",
    marketTags: ["GLOBAL"],
    priority: 85,
    imageKey: "global-shortlet-flexible",
  },
  {
    id: "global-rent-family-homes",
    title: "Family-ready rentals",
    subtitle: "Space-first homes with practical amenities.",
    category: "rent",
    tag: "To rent",
    marketTags: ["GLOBAL"],
    priority: 80,
    imageKey: "global-rent-family",
  },
  {
    id: "global-buy-verified",
    title: "Verified homes to buy",
    subtitle: "Clear listing status and trusted seller signals.",
    category: "buy",
    tag: "For sale",
    marketTags: ["GLOBAL"],
    priority: 78,
    imageKey: "global-buy-verified",
  },
  {
    id: "global-offplan-long-horizon",
    title: "Off-plan opportunities",
    subtitle: "Projects suited to long-horizon planning.",
    category: "off_plan",
    tag: "Off-plan",
    marketTags: ["GLOBAL"],
    priority: 72,
    imageKey: "global-offplan",
  },
  {
    id: "global-all-homes-discovery",
    title: "All homes discovery",
    subtitle: "Browse broadly before narrowing your shortlist.",
    category: "all",
    tag: "All homes",
    marketTags: ["GLOBAL"],
    priority: 70,
    imageKey: "global-all-homes",
  },
  {
    id: "ng-shortlet-lagos-weekend",
    title: "Weekend shortlets in Lagos",
    subtitle: "Curated stays for fast city breaks.",
    category: "shortlet",
    city: "Lagos",
    shortletParams: { guests: "2", sort: "recommended" },
    tag: "Shortlets",
    marketTags: ["NG"],
    priority: 95,
    imageKey: "ng-lagos-weekend",
  },
  {
    id: "ng-rent-abuja-family",
    title: "Family rentals in Abuja",
    subtitle: "Space-first homes in central districts.",
    category: "rent",
    city: "Abuja",
    tag: "To rent",
    marketTags: ["NG"],
    priority: 92,
    imageKey: "ng-abuja-family",
  },
  {
    id: "ng-buy-lagos-verified",
    title: "Buy verified homes in Lagos",
    subtitle: "Ready-to-view listings with clear status.",
    category: "buy",
    city: "Lagos",
    tag: "For sale",
    marketTags: ["NG"],
    priority: 90,
    imageKey: "ng-buy-lagos",
  },
  {
    id: "ng-offplan-abuja-growth",
    title: "Off-plan picks in Abuja",
    subtitle: "Projects with long-horizon upside.",
    category: "off_plan",
    city: "Abuja",
    tag: "Off-plan",
    marketTags: ["NG"],
    priority: 88,
    imageKey: "ng-offplan-abuja",
  },
  {
    id: "gb-shortlet-london-central",
    title: "Central shortlets in London",
    subtitle: "Reliable options for quick city stays.",
    category: "shortlet",
    city: "London",
    shortletParams: { guests: "2", sort: "recommended" },
    tag: "Shortlets",
    marketTags: ["GB"],
    priority: 95,
    imageKey: "gb-shortlet-london",
  },
  {
    id: "gb-rent-manchester-family",
    title: "Family rentals in Manchester",
    subtitle: "Neighbourhood homes with balanced commute access.",
    category: "rent",
    city: "Manchester",
    tag: "To rent",
    marketTags: ["GB"],
    priority: 92,
    imageKey: "gb-rent-manchester",
  },
  {
    id: "gb-buy-birmingham-verified",
    title: "Buy verified homes in Birmingham",
    subtitle: "Trust-first listings with clear details.",
    category: "buy",
    city: "Birmingham",
    tag: "For sale",
    marketTags: ["GB"],
    priority: 90,
    imageKey: "gb-buy-birmingham",
  },
  {
    id: "gb-offplan-leeds-growth",
    title: "Off-plan options in Leeds",
    subtitle: "Growth-focused inventory for long-term plans.",
    category: "off_plan",
    city: "Leeds",
    tag: "Off-plan",
    marketTags: ["GB"],
    priority: 88,
    imageKey: "gb-offplan-leeds",
  },
  {
    id: "ca-shortlet-toronto-downtown",
    title: "Downtown shortlets in Toronto",
    subtitle: "One-tap stays for business and weekend trips.",
    category: "shortlet",
    city: "Toronto",
    shortletParams: { guests: "2", sort: "recommended" },
    tag: "Shortlets",
    marketTags: ["CA"],
    priority: 95,
    imageKey: "ca-shortlet-toronto",
  },
  {
    id: "ca-rent-vancouver-family",
    title: "Family rentals in Vancouver",
    subtitle: "Comfortable homes near key transit corridors.",
    category: "rent",
    city: "Vancouver",
    tag: "To rent",
    marketTags: ["CA"],
    priority: 92,
    imageKey: "ca-rent-vancouver",
  },
  {
    id: "ca-buy-calgary-verified",
    title: "Buy verified homes in Calgary",
    subtitle: "High-confidence listings with transparent status.",
    category: "buy",
    city: "Calgary",
    tag: "For sale",
    marketTags: ["CA"],
    priority: 90,
    imageKey: "ca-buy-calgary",
  },
  {
    id: "ca-offplan-montreal-growth",
    title: "Off-plan projects in Montreal",
    subtitle: "New-build opportunities with long-term upside.",
    category: "off_plan",
    city: "Montreal",
    tag: "Off-plan",
    marketTags: ["CA"],
    priority: 88,
    imageKey: "ca-offplan-montreal",
  },
];

import {
  PROPERTIES_BROWSE_CATEGORY_OPTIONS,
  type PropertiesBrowseCategory,
} from "@/lib/properties/browse-categories";
import type { ShortletSearchPreset } from "@/lib/shortlet/search-presets";

export type MobileQuickSearchCategory = PropertiesBrowseCategory;

export type MobileQuickSearchCategoryOption = {
  key: MobileQuickSearchCategory;
  label: string;
};

export type MobileQuickSearchPreset = {
  id: string;
  label: string;
  category: MobileQuickSearchCategory;
  city?: string;
  shortletParams?: Record<string, string>;
};

// Keep mobile quick-search category chips aligned with the shared /properties browse rail,
// including the "All homes" default-first ordering.
export const MOBILE_QUICKSEARCH_CATEGORY_OPTIONS: MobileQuickSearchCategoryOption[] =
  PROPERTIES_BROWSE_CATEGORY_OPTIONS.map((option) => ({
    key: option.value,
    label: option.label,
  }));

const PROPERTY_PRESETS: MobileQuickSearchPreset[] = [
  { id: "rent-lagos", label: "Lagos rentals", category: "rent", city: "Lagos" },
  { id: "rent-abuja", label: "Abuja rentals", category: "rent", city: "Abuja" },
  { id: "buy-lagos", label: "Buy in Lagos", category: "buy", city: "Lagos" },
  { id: "buy-abuja", label: "Buy in Abuja", category: "buy", city: "Abuja" },
  { id: "offplan-lagos", label: "Off-plan in Lagos", category: "off_plan", city: "Lagos" },
  { id: "all-homes", label: "All homes", category: "all" },
];

const SHORTLET_FALLBACK_PRESETS: MobileQuickSearchPreset[] = [
  { id: "shortlet-lagos", label: "Weekend in Lagos", category: "shortlet", city: "Lagos" },
  { id: "shortlet-abuja", label: "Abuja stay", category: "shortlet", city: "Abuja" },
];

function normalizeCity(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function mapShortletRecents(recents: ShortletSearchPreset[]): MobileQuickSearchPreset[] {
  return recents.map((preset) => ({
    id: `shortlet-recent-${preset.id}`,
    label: preset.label,
    category: "shortlet",
    city: normalizeCity(preset.params.where),
    shortletParams: preset.params,
  }));
}

function dedupeById(items: MobileQuickSearchPreset[]): MobileQuickSearchPreset[] {
  const seen = new Set<string>();
  const deduped: MobileQuickSearchPreset[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    deduped.push(item);
  }
  return deduped;
}

export function buildMobileQuickSearchPresetList(input: {
  category: MobileQuickSearchCategory;
  shortletRecents: ShortletSearchPreset[];
  limit?: number;
}): MobileQuickSearchPreset[] {
  const limit = Math.max(1, input.limit ?? 6);
  if (input.category === "shortlet") {
    const shortletPresets = dedupeById([
      ...mapShortletRecents(input.shortletRecents),
      ...SHORTLET_FALLBACK_PRESETS,
    ]);
    return shortletPresets.slice(0, limit);
  }

  if (input.category === "all") {
    return PROPERTY_PRESETS.slice(0, limit);
  }

  const filtered = PROPERTY_PRESETS.filter((preset) => preset.category === input.category);
  return (filtered.length ? filtered : PROPERTY_PRESETS).slice(0, limit);
}

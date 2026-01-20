export const LOCATION_MICROCOPY = {
  section: {
    title: "Location",
    helper: "Used for search relevance and map placement.",
  },
  search: {
    label: "Search for an area",
    placeholder: "Start typing a neighbourhood, estate, or city…",
    helper1:
      "Start here — choose the general area first. We’ll pin an approximate location and auto-fill the fields below.",
    helper2: "Tenants see an approximate area until you choose to share the exact location.",
    loading: "Searching...",
    empty: "No matches. Try a nearby area or city.",
    notConfigured:
      "Location search isn’t configured yet. You can still enter the details below or add coordinates manually.",
    action: "Use",
  },
  results: {
    subtitleFormat: "neighbourhood/locality • city • region/district • country",
  },
  pinned: {
    title: "Pinned area",
    secondary: "Approximate area (from search)",
    helper: "No coordinates are shown; this is an approximate area.",
    noPin: "No pin selected yet.",
    change: "Change",
    mapMissing: "Map preview isn’t configured yet.",
    mapFailed: "Map preview unavailable.",
  },
  fields: {
    countryLabel: "Country",
    countryDerived: "Derived from area search (you can edit this)",
    stateLabel: "State / Region",
    cityLabel: "City",
    neighbourhoodLabel: "Neighbourhood",
    derived: "Derived from search (editable)",
  },
  address: {
    label: "Address",
    placeholder: "Street, building, house number",
    helper: "Optional. Not used for map search.",
  },
  locationLabel: {
    label: "Location label (shown to tenants as area)",
  },
  advanced: {
    toggle: "Edit coordinates manually",
    helper: "Only adjust this if you know the exact latitude and longitude.",
  },
  publishGuard: {
    title: "Pin your listing location to publish",
    body: "Add an approximate area so guests know where your place is located.",
    cta: "Go to location",
  },
};

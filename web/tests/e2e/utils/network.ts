import type { Page } from "@playwright/test";

type MockShortletItem = {
  id: string;
  title: string;
  city: string;
  country: string;
  currency: string;
  latitude: number | null;
  longitude: number | null;
  nightlyPriceMinor: number | null;
  pricingMode: "nightly" | "price_on_request";
  bookingMode: "instant" | "request";
  primaryImageUrl: string;
};

function createMockShortletItems(): MockShortletItem[] {
  return [
    {
      id: "smoke-shortlet-1",
      title: "Short stay apartment in Lekki",
      city: "Lagos",
      country: "Nigeria",
      currency: "NGN",
      latitude: 6.4425,
      longitude: 3.4553,
      nightlyPriceMinor: 45000000,
      pricingMode: "nightly",
      bookingMode: "instant",
      primaryImageUrl: "/logo.png",
    },
    {
      id: "smoke-shortlet-2",
      title: "Designer studio in Kilimani",
      city: "Nairobi",
      country: "Kenya",
      currency: "KES",
      latitude: -1.2921,
      longitude: 36.8219,
      nightlyPriceMinor: null,
      pricingMode: "price_on_request",
      bookingMode: "request",
      primaryImageUrl: "/logo.png",
    },
    {
      id: "smoke-shortlet-3",
      title: "Business suite in Abuja",
      city: "Abuja",
      country: "Nigeria",
      currency: "NGN",
      latitude: 9.0765,
      longitude: 7.3986,
      nightlyPriceMinor: 23000000,
      pricingMode: "nightly",
      bookingMode: "request",
      primaryImageUrl: "/logo.png",
    },
  ];
}

export function buildShortletsSearchResponse() {
  const items = createMockShortletItems().map((item) => ({
    ...item,
    mapPreviewImageUrl: item.primaryImageUrl,
    imageUrls: [item.primaryImageUrl, item.primaryImageUrl],
    images: [
      { id: `${item.id}-image-1`, image_url: item.primaryImageUrl },
      { id: `${item.id}-image-2`, image_url: item.primaryImageUrl },
    ],
    nightlyPrice: item.nightlyPriceMinor ? item.nightlyPriceMinor / 100 : null,
    bedrooms: 2,
    bathrooms: 2,
    guests: 2,
    amenities: ["power backup", "security"],
    freeCancellation: true,
    verifiedHost: true,
  }));

  const mapItems = items.map((item) => ({
    id: item.id,
    title: item.title,
    city: item.city,
    currency: item.currency,
    nightlyPriceMinor: item.nightlyPriceMinor,
    pricingMode: item.pricingMode,
    bookingMode: item.bookingMode,
    primaryImageUrl: item.primaryImageUrl,
    mapPreviewImageUrl: item.mapPreviewImageUrl,
    latitude: item.latitude,
    longitude: item.longitude,
  }));

  return {
    ok: true,
    page: 1,
    pageSize: 24,
    total: items.length,
    items,
    mapItems,
    nearbyAlternatives: [],
  };
}

export async function mockShortletsSearch(page: Page) {
  const payload = buildShortletsSearchResponse();
  await page.route("**/api/shortlets/search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
  return payload;
}

export async function mockSequentialJson(
  page: Page,
  pattern: string | RegExp,
  payloads: unknown[],
  status = 200
) {
  let index = 0;
  await page.route(pattern, async (route) => {
    const next = payloads[Math.min(index, payloads.length - 1)] ?? {};
    index += 1;
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(next),
    });
  });
}

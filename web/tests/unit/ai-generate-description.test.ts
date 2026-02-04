import test from "node:test";
import assert from "node:assert/strict";

import { generateDescriptionResponse } from "../../app/api/ai/generate-description/route";

void test("AI description returns 503 when not configured", async () => {
  const prevKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const response = await generateDescriptionResponse({
      title: "Modern 2-bed apartment",
      city: "Lagos",
      neighbourhood: "Lekki",
      rentalType: "long_term",
      listingIntent: "rent",
      listingType: "apartment",
      price: 1200,
      currency: "USD",
      bedrooms: 2,
      bathrooms: 2,
      furnished: true,
      amenities: ["wifi"],
      maxGuests: 4,
      nearbyLandmarks: [],
    });

    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error, "AI not configured");
  } finally {
    if (prevKey) {
      process.env.OPENAI_API_KEY = prevKey;
    }
  }
});

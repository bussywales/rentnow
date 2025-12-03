import { NextResponse } from "next/server";
import { z } from "zod";
import { openai, assertOpenAiKey } from "@/lib/openai";

const bodySchema = z.object({
  query: z.string().min(3),
});

const defaultFilters = {
  city: null,
  minPrice: null,
  maxPrice: null,
  currency: null,
  bedrooms: null,
  rentalType: null,
  furnished: null,
  amenities: [] as string[],
};

export async function POST(request: Request) {
  try {
    assertOpenAiKey();
    const json = await request.json();
    const { query } = bodySchema.parse(json);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0,
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `
You are a strict JSON API for a rental property search engine.

Your job: convert a natural language query about renting a property into a JSON object
with filters.

Output MUST be valid, minified JSON with this exact shape:

{
  "city": string | null,
  "minPrice": number | null,
  "maxPrice": number | null,
  "currency": string | null,
  "bedrooms": number | null,
  "rentalType": "short_let" | "long_term" | null,
  "furnished": boolean | null,
  "amenities": string[]
}

Rules:
- If the query doesn’t specify a field, set it to null (or [] for amenities).
- Detect city names mentioned in the text when possible.
- Detect price amounts and infer min/max when phrases like "under", "below", "at least" appear.
- Use currencies like "USD", "NGN", "KES", etc. If not clear, set currency to null.
- rentalType:
  - If query mentions "short let", "airbnb", "vacation", "daily", "weekly", "weekend", set "short_let".
  - If query mentions "long term", "1-year", "12 months", "annual", or "for living", set "long_term".
- furnished:
  - If query says "furnished" or "fully furnished", set true.
  - If query says "unfurnished", set false.
- amenities: add words like "parking", "wifi", "internet", "security", "pool", "gym" if clearly required.

Return ONLY the JSON. No explanation, no comments, no extra text.
          `.trim(),
        },
        {
          role: "user",
          content: `User query: "${query}". Convert this into the JSON filters.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    let filters = defaultFilters;
    try {
      filters = JSON.parse(raw);
    } catch (err) {
      console.warn("Failed to parse AI JSON", err);
    }

    return NextResponse.json({ filters });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to parse search";
    console.error(error);
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI, assertOpenAiKey } from "@/lib/openai";

const bodySchema = z.object({
  title: z.string().min(3),
  city: z.string().min(2),
  neighbourhood: z.string().optional(),
  rentalType: z.enum(["short_let", "long_term"]),
  price: z.number(),
  currency: z.string().min(2),
  bedrooms: z.number().int(),
  bathrooms: z.number().int(),
  furnished: z.boolean(),
  amenities: z.array(z.string()).optional(),
  maxGuests: z.number().int().nullable().optional(),
  nearbyLandmarks: z.array(z.string()).optional(),
});

type BodyInput = z.infer<typeof bodySchema>;

function buildFallbackDescription(data: BodyInput) {
  const location = `${data.city}${data.neighbourhood ? ` - ${data.neighbourhood}` : ""}`;
  const rentalLabel = data.rentalType === "short_let" ? "short-let" : "long-term rental";
  const amenities = (data.amenities || []).slice(0, 5).join(", ");
  const furnished = data.furnished ? "Furnished" : "Unfurnished";
  const length =
    data.rentalType === "short_let" ? "nightly stays" : "monthly living";

  return [
    `${data.title} is a ${data.bedrooms}-bed, ${data.bathrooms}-bath ${rentalLabel} in ${location}.`,
    `${furnished}${amenities ? ` - Amenities: ${amenities}.` : "."}`,
    `From ${data.price} ${data.currency} for ${length}.`,
  ].join(" ");
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const data = bodySchema.parse(json);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        description: buildFallbackDescription(data),
        note: "OPENAI_API_KEY is missing; returned a templated description.",
      });
    }

    assertOpenAiKey();

    const userPrompt = `
Write a rental listing description for the following property details:

- Title: ${data.title}
- City: ${data.city}
- Neighbourhood: ${data.neighbourhood || "N/A"}
- Rental type: ${data.rentalType}
- Price: ${data.price} ${data.currency}
- Bedrooms: ${data.bedrooms}
- Bathrooms: ${data.bathrooms}
- Furnished: ${data.furnished ? "Yes" : "No"}
- Amenities: ${(data.amenities || []).join(", ") || "None specified"}
- Max guests: ${data.maxGuests ?? "N/A"}
- Nearby landmarks: ${(data.nearbyLandmarks || []).join(", ") || "None specified"}

Remember: 120-200 words, clear and honest, simple English, no invented features.
    `.trim();

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.7,
      max_tokens: 180,
      messages: [
        {
          role: "system",
          content:
            "You are an expert real estate copywriter for African rental properties. Write clear, attractive, honest listing descriptions. 120-200 words. Highlight bedrooms, bathrooms, furnished status, amenities, city, and neighbourhood. No invented features. Return only the description text.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const description = completion.choices[0]?.message?.content?.trim() || "";
    return NextResponse.json({ description });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to generate description";
    console.error(error);
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}

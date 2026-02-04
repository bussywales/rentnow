import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/authz";
import { logFailure } from "@/lib/observability";
import { getOpenAI, assertOpenAiKey } from "@/lib/openai";

const routeLabel = "/api/ai/generate-description";

const bodySchema = z.object({
  title: z.string().min(3),
  city: z.string().min(2),
  neighbourhood: z.string().optional(),
  rentalType: z.enum(["short_let", "long_term"]).optional(),
  listingIntent: z.enum(["rent", "buy"]).optional(),
  listingType: z.string().optional(),
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

export async function generateDescriptionResponse(
  data: BodyInput,
  request?: Request,
  startTime?: number
) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  try {
    assertOpenAiKey();

    const intentLabel = data.listingIntent === "buy" ? "for sale" : "for rent/lease";
    const listingType = data.listingType ? data.listingType : "N/A";
    const rentalType = data.rentalType ?? "N/A";

    const userPrompt = `
Write a real estate listing description for the following property details:

- Title: ${data.title}
- City: ${data.city}
- Neighbourhood: ${data.neighbourhood || "N/A"}
- Listing intent: ${data.listingIntent || "rent"} (${intentLabel})
- Listing type: ${listingType}
- Rental type: ${rentalType}
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
            "You are an expert real estate copywriter for African rentals and sales. Write clear, attractive, honest listing descriptions (120-200 words). If the listing intent is for sale, avoid rental language; if it is for rent/lease, avoid sale language. Highlight bedrooms, bathrooms, furnished status, amenities, city, neighbourhood, and listing type. No invented features. Return only the description text.",
        },
        { role: "user", content: userPrompt },
      ],
    });

    const description = completion.choices[0]?.message?.content?.trim() || "";
    return NextResponse.json({ description });
  } catch (error: unknown) {
    if (request && typeof startTime === "number") {
      logFailure({
        request,
        route: routeLabel,
        status: 502,
        startTime,
        error,
      });
    } else {
      console.error(error);
    }
    return NextResponse.json(
      { error: "Unable to generate description" },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent", "admin"],
  });
  if (!auth.ok) return auth.response;

  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }
    return generateDescriptionResponse(parsed.data, request, startTime);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unable to generate description";
    console.error(error);
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}

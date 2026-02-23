import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI } from "@/lib/openai";
import { searchSupportHelpDocs, type SupportHelpSearchResult } from "@/lib/support/help-search";

const bodySchema = z.object({
  message: z.string().min(2).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .max(30)
    .optional()
    .default([]),
});

type AssistantConfidence = "high" | "med" | "low";

export type SupportAssistantResponsePayload = {
  answer: string;
  suggestedArticles: SupportHelpSearchResult[];
  confidence: AssistantConfidence;
  shouldEscalate: boolean;
  escalationReason: string | null;
};

export type SupportAssistantDeps = {
  searchSupportHelpDocs: typeof searchSupportHelpDocs;
  hasOpenAiKey: () => boolean;
  completeWithContext: (input: {
    message: string;
    context: SupportHelpSearchResult[];
  }) => Promise<string | null>;
};

function resolveConfidence(results: SupportHelpSearchResult[]): AssistantConfidence {
  if (!results.length) return "low";
  if (results.length >= 2 && results[0].score >= 8) return "high";
  return "med";
}

function hasEscalationKeyword(message: string) {
  const text = message.toLowerCase();
  const criticalTokens = [
    "chargeback",
    "fraud",
    "hacked",
    "stolen card",
    "police",
    "legal threat",
  ];
  return criticalTokens.some((token) => text.includes(token));
}

function isChargedButNoBooking(message: string) {
  const text = message.toLowerCase();
  return text.includes("charged") && text.includes("no booking");
}

function countStillNotWorking(history: Array<{ role: "user" | "assistant"; content: string }>, current: string) {
  const pool = [...history, { role: "user", content: current }];
  return pool.filter((entry) => {
    if (entry.role !== "user") return false;
    return entry.content.toLowerCase().includes("still not working");
  }).length;
}

function resolveEscalation(input: {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  confidence: AssistantConfidence;
  results: SupportHelpSearchResult[];
}): { shouldEscalate: boolean; reason: string | null } {
  if (hasEscalationKeyword(input.message)) {
    return { shouldEscalate: true, reason: "critical_keyword" };
  }
  if (isChargedButNoBooking(input.message) && input.results.length === 0) {
    return { shouldEscalate: true, reason: "charged_without_booking_no_doc_match" };
  }
  if (countStillNotWorking(input.history, input.message) >= 2) {
    return { shouldEscalate: true, reason: "repeat_failure_reported" };
  }
  if (input.confidence === "low") {
    return { shouldEscalate: true, reason: "low_confidence" };
  }
  return { shouldEscalate: false, reason: null };
}

function buildFallbackAnswer(
  message: string,
  context: SupportHelpSearchResult[],
  shouldEscalate: boolean
) {
  const lead = `I checked our help guidance for: "${message.trim()}".`;
  if (!context.length) {
    return shouldEscalate
      ? `${lead} I could not find a strong direct match, so I recommend escalating to support now.`
      : `${lead} I could not find a direct match yet. Please share more detail so I can narrow it down.`;
  }
  const top = context[0];
  return `${lead} Start with "${top.title}". ${top.snippet}`;
}

async function completeWithContext(input: {
  message: string;
  context: SupportHelpSearchResult[];
}) {
  const openai = getOpenAI();
  const contextBlock = input.context
    .map((item, index) => `${index + 1}. ${item.title}\n${item.snippet}\nLink: ${item.href}`)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.1,
    max_tokens: 260,
    messages: [
      {
        role: "system",
        content:
          "You are PropatyHub support assistant. Answer ONLY using supplied help context. If context is insufficient, say so briefly and recommend escalation.",
      },
      {
        role: "user",
        content: `User question: ${input.message}\n\nHelp context:\n${contextBlock}\n\nReturn a short actionable answer.`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() || null;
}

const defaultDeps: SupportAssistantDeps = {
  searchSupportHelpDocs,
  hasOpenAiKey: () => Boolean(process.env.OPENAI_API_KEY),
  completeWithContext,
};

export async function postSupportAssistantResponse(
  request: Request,
  deps: SupportAssistantDeps = defaultDeps
) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const message = body.data.message.trim();
  const context = await deps.searchSupportHelpDocs(message, 4);
  const confidence = resolveConfidence(context);
  const escalation = resolveEscalation({
    message,
    history: body.data.history,
    confidence,
    results: context,
  });

  let answer = buildFallbackAnswer(message, context, escalation.shouldEscalate);
  if (deps.hasOpenAiKey() && context.length > 0) {
    try {
      const completion = await deps.completeWithContext({ message, context });
      if (completion) answer = completion;
    } catch {
      // Keep deterministic fallback answer.
    }
  }

  const payload: SupportAssistantResponsePayload = {
    answer,
    suggestedArticles: context,
    confidence,
    shouldEscalate: escalation.shouldEscalate,
    escalationReason: escalation.reason,
  };

  return NextResponse.json(payload);
}

export async function POST(request: Request) {
  return postSupportAssistantResponse(request, defaultDeps);
}


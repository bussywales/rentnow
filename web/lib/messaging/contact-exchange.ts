import type { ContactExchangeMode } from "@/lib/settings/app-settings";

export const CONTACT_EXCHANGE_BLOCK_CODE = "CONTACT_EXCHANGE_BLOCKED";
export const CONTACT_EXCHANGE_BLOCK_MESSAGE =
  "For your safety, contact details can't be shared in messages. Please keep communication in RentNow.";
export const CONTACT_EXCHANGE_COMPOSER_NOTICE =
  "For your safety, contact details are hidden until booking is confirmed.";

const EMAIL_REGEX =
  /([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})/gi;
const OBFUSCATED_EMAIL_REGEX =
  /([a-z0-9._%+-]+)\s*(?:\(|\[)?\s*at\s*(?:\)|\])?\s*([a-z0-9.-]+)\s*(?:\(|\[)?\s*dot\s*(?:\)|\])?\s*([a-z]{2,})/gi;
const PHONE_CANDIDATE_REGEX = /(\+?\d[\d\s().-]{6,}\d)/g;
const CONTACT_PHRASE_REGEX =
  /(whats\s*app|whatsapp|call me|text me|dm me|message me on|reach me on|my number is|email me|send to my email)/gi;

type ModerationMeta = {
  redacted: boolean;
  types: string[];
  counts: { email: number; phone: number };
  phrases?: string[];
};

export type ContactExchangeResult = {
  action: "allow" | "redact" | "block";
  text: string;
  meta?: ModerationMeta;
};

function isLikelyPriceContext(source: string, index: number) {
  const prefix = source.slice(Math.max(0, index - 6), index).toLowerCase();
  return /(usd|ngn|gbp|eur|\$|£|₦)\s*$/.test(prefix);
}

function looksLikePhone(match: string, source: string, index: number) {
  if (isLikelyPriceContext(source, index)) return false;
  const digits = match.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return false;
  if (/^\d+$/.test(match) && digits.length <= 6) return false;
  return true;
}

export function sanitizeMessageContent(
  input: string,
  mode: ContactExchangeMode
): ContactExchangeResult {
  if (mode === "off") {
    return { action: "allow", text: input };
  }

  let sanitized = input;
  let emailCount = 0;
  let phoneCount = 0;
  const phrases = new Set<string>();

  sanitized = sanitized.replace(OBFUSCATED_EMAIL_REGEX, () => {
    emailCount += 1;
    return "[email removed]";
  });

  sanitized = sanitized.replace(EMAIL_REGEX, () => {
    emailCount += 1;
    return "[email removed]";
  });

  sanitized = sanitized.replace(PHONE_CANDIDATE_REGEX, (match, _group, offset) => {
    if (!looksLikePhone(match, input, offset)) return match;
    phoneCount += 1;
    return "[phone removed]";
  });

  let phraseMatch: RegExpExecArray | null;
  const phraseRegex = new RegExp(CONTACT_PHRASE_REGEX.source, "gi");
  while ((phraseMatch = phraseRegex.exec(input)) !== null) {
    if (phraseMatch[0]) {
      phrases.add(phraseMatch[0].toLowerCase());
    }
  }

  const redacted = emailCount > 0 || phoneCount > 0;
  const shouldStoreMeta = redacted || phrases.size > 0;
  const meta: ModerationMeta | undefined = shouldStoreMeta
    ? {
        redacted,
        types: [
          ...(emailCount > 0 ? ["email"] : []),
          ...(phoneCount > 0 ? ["phone"] : []),
        ],
        counts: { email: emailCount, phone: phoneCount },
        phrases: phrases.size ? Array.from(phrases) : undefined,
      }
    : undefined;

  if (mode === "block" && redacted) {
    return {
      action: "block",
      text: input,
      meta,
    };
  }

  if (mode === "redact" && redacted) {
    return {
      action: "redact",
      text: sanitized,
      meta,
    };
  }

  return { action: "allow", text: input, meta };
}

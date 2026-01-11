export const QUICK_REPLIES = [
  "Is this still available?",
  "Can we schedule a viewing?",
  "What's the minimum stay?",
  "Can you share more photos?",
];

export function applyQuickReply(current: string, reply: string): string {
  const trimmed = current.trim();
  if (!trimmed) return reply;
  return `${trimmed} ${reply}`;
}

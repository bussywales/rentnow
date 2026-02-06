export type StorefrontViewState = "unavailable" | "empty" | "ready";

export function resolveStorefrontViewState(input: {
  ok: boolean;
  listingsCount: number;
}): StorefrontViewState {
  if (!input.ok) return "unavailable";
  if (input.listingsCount <= 0) return "empty";
  return "ready";
}

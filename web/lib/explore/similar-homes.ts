import type { Property } from "@/lib/types";
import { resolveExploreListingKind } from "@/lib/explore/explore-presentation";

const MAX_SIMILAR_HOMES = 3;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function resolveListingScore(current: Property, candidate: Property): number {
  if (current.id === candidate.id) return -1;

  let score = 0;

  if (resolveExploreListingKind(current) === resolveExploreListingKind(candidate)) {
    score += 3;
  }
  if ((current.listing_intent ?? null) === (candidate.listing_intent ?? null)) {
    score += 2;
  }
  if ((current.rental_type ?? null) === (candidate.rental_type ?? null)) {
    score += 1;
  }

  const currentCity = normalizeText(current.city);
  const candidateCity = normalizeText(candidate.city);
  if (currentCity && currentCity === candidateCity) {
    score += 2;
  }

  const currentNeighbourhood = normalizeText(current.neighbourhood);
  const candidateNeighbourhood = normalizeText(candidate.neighbourhood);
  if (currentNeighbourhood && currentNeighbourhood === candidateNeighbourhood) {
    score += 1;
  }

  const bedroomDelta = Math.abs((current.bedrooms ?? 0) - (candidate.bedrooms ?? 0));
  if (bedroomDelta <= 1) {
    score += 1;
  }

  return score;
}

export function resolveSimilarHomes(current: Property, listings: ReadonlyArray<Property>, limit = MAX_SIMILAR_HOMES) {
  const cappedLimit = Math.max(1, Math.min(MAX_SIMILAR_HOMES, Math.trunc(limit)));

  return listings
    .map((candidate) => ({
      candidate,
      score: resolveListingScore(current, candidate),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.candidate.id.localeCompare(b.candidate.id);
    })
    .slice(0, cappedLimit)
    .map((entry) => entry.candidate);
}

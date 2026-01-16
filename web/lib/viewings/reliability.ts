export type ReliabilitySnapshot = {
  noShowCount90d: number;
  completedCount90d: number;
  label: "Reliable" | "Mixed" | "Unknown";
};

export function deriveReliability(noShowCount90d: number, completedCount90d: number): ReliabilitySnapshot {
  if (noShowCount90d >= 1) {
    return { noShowCount90d, completedCount90d, label: "Mixed" };
  }
  if (completedCount90d >= 1) {
    return { noShowCount90d, completedCount90d, label: "Reliable" };
  }
  return { noShowCount90d, completedCount90d, label: "Unknown" };
}

export function maskIdentifier(value: string | null | undefined, prefix = 6, suffix = 4) {
  if (!value) return "—";
  const trimmed = String(value);
  if (trimmed.length <= prefix + suffix) return trimmed;
  return `${trimmed.slice(0, prefix)}...${trimmed.slice(-suffix)}`;
}

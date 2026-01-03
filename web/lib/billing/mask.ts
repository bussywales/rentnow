export function maskIdentifier(value: string | null | undefined, prefix = 6, suffix = 4) {
  if (!value) return "—";
  const trimmed = String(value);
  if (trimmed.length <= prefix + suffix) return trimmed;
  return `${trimmed.slice(0, prefix)}...${trimmed.slice(-suffix)}`;
}

export function maskEmail(value: string | null | undefined) {
  if (!value) return "—";
  const [local, domain] = value.split("@");
  if (!domain) return maskIdentifier(value, 3, 2);
  const visibleLocal = local.slice(0, 2);
  return `${visibleLocal}***@${domain}`;
}

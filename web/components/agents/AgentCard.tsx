import Link from "next/link";
import { Button } from "@/components/ui/Button";

export type DirectoryAgentCardItem = {
  id: string;
  displayName: string;
  location?: string | null;
  verified: boolean;
  avatarUrl?: string | null;
  href: string;
};

function resolveInitials(name: string) {
  const words = name
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  if (!words.length) return "AG";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export function AgentCard({ agent }: { agent: DirectoryAgentCardItem }) {
  return (
    <article
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      data-testid="agents-directory-card"
    >
      <div className="flex items-start gap-3">
        {agent.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={agent.avatarUrl}
            alt={agent.displayName}
            className="h-12 w-12 rounded-full border border-slate-200 object-cover"
            loading="lazy"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700"
          >
            {resolveInitials(agent.displayName)}
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-base font-semibold text-slate-900">{agent.displayName}</h3>
          <p className="truncate text-sm text-slate-600">
            {agent.location || "Location available on profile"}
          </p>
          {agent.verified ? (
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700">
              Verified
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
              Agent profile
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={agent.href} className="inline-flex">
          <Button size="sm">View profile</Button>
        </Link>
        <Link href="/support" className="inline-flex">
          <Button size="sm" variant="secondary">
            Contact support
          </Button>
        </Link>
      </div>
    </article>
  );
}

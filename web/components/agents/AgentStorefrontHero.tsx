"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { cn } from "@/components/ui/cn";
import AgentStorefrontHeroActions from "@/components/agents/AgentStorefrontHeroActions";

type Props = {
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  coverImageUrl?: string | null;
  companyName?: string | null;
  logoUrl?: string | null;
  eyebrow?: string;
  listingsCount: number;
  shareUrl: string;
  contactAnchor?: string;
  trustChips?: string[];
};

const FALLBACK_BIO =
  "Helping tenants and buyers find the right home across PropatyHub with trusted guidance and local market insight.";

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "A";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

export default function AgentStorefrontHero({
  name,
  bio,
  avatarUrl,
  coverImageUrl,
  companyName,
  logoUrl,
  eyebrow = "Agent storefront",
  listingsCount,
  shareUrl,
  contactAnchor,
  trustChips = [],
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const bioText = bio?.trim() || FALLBACK_BIO;
  const maxLength = 180;
  const shouldTruncate = bioText.length > maxLength;
  const displayBio = shouldTruncate && !expanded ? `${bioText.slice(0, maxLength).trim()}…` : bioText;
  const initials = useMemo(() => getInitials(name), [name]);

  return (
    <section
      className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-slate-900 text-white"
      data-testid="agent-storefront-hero"
    >
      <div className="absolute inset-0">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt="Agent storefront cover"
            fill
            className="object-cover opacity-55"
            sizes="(max-width: 1024px) 100vw, 1200px"
            priority={false}
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.35),transparent_55%),linear-gradient(135deg,#0f172a,#0b1120)]" />
        )}
      </div>
      <div className="relative z-10 grid gap-6 px-6 py-8 md:grid-cols-[auto,1fr,auto] md:items-center md:gap-8 md:px-10">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-white/60 bg-white/20">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={companyName || name}
                fill
                className="object-cover"
                sizes="64px"
                priority={false}
              />
            ) : avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={name}
                fill
                className="object-cover"
                sizes="64px"
                priority={false}
              />
            ) : (
              <span className="text-lg font-semibold uppercase text-white">{initials}</span>
            )}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200">
              {eyebrow}
            </p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">{name}</h1>
            {companyName && (
              <p className="mt-1 text-sm font-semibold text-slate-100/90">{companyName}</p>
            )}
            <p className="mt-1 text-sm text-slate-100/90">
              {listingsCount} active {listingsCount === 1 ? "listing" : "listings"}
            </p>
          </div>
        </div>

        <div className="max-w-2xl text-sm text-slate-100/90">
          <p>{displayBio}</p>
          {shouldTruncate && (
            <button
              type="button"
              className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-200 hover:text-white"
              onClick={() => setExpanded((prev) => !prev)}
              data-testid="agent-storefront-bio-toggle"
            >
              {expanded ? "Read less" : "Read more"}
            </button>
          )}
          {trustChips.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {trustChips.map((chip) => (
                <span
                  key={chip}
                  className={cn(
                    "rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]",
                    "text-white/90"
                  )}
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>

        <AgentStorefrontHeroActions shareUrl={shareUrl} contactAnchor={contactAnchor} />
      </div>
    </section>
  );
}

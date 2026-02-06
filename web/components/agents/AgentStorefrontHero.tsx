import Image from "next/image";
import AgentStorefrontHeroActions from "@/components/agents/AgentStorefrontHeroActions";

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80";

type Props = {
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  coverImageUrl?: string | null;
  listingsCount: number;
  shareUrl: string;
  contactAnchor?: string;
};

export default function AgentStorefrontHero({
  name,
  bio,
  avatarUrl,
  coverImageUrl,
  listingsCount,
  shareUrl,
  contactAnchor,
}: Props) {
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
          <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-white/60 bg-white/20">
            <Image
              src={avatarUrl || FALLBACK_AVATAR}
              alt={name}
              fill
              className="object-cover"
              sizes="64px"
              priority={false}
            />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-200">
              Agent storefront
            </p>
            <h1 className="text-3xl font-semibold text-white sm:text-4xl">{name}</h1>
            <p className="mt-1 text-sm text-slate-100/90">
              {listingsCount} active {listingsCount === 1 ? "listing" : "listings"}
            </p>
          </div>
        </div>

        <div className="max-w-2xl text-sm text-slate-100/90">
          {bio ? (
            <p>{bio}</p>
          ) : (
            <p>
              Helping tenants and buyers find the right home across PropatyHub with trusted guidance
              and local market insight.
            </p>
          )}
        </div>

        <AgentStorefrontHeroActions shareUrl={shareUrl} contactAnchor={contactAnchor} />
      </div>
    </section>
  );
}

import { BootcampTrackedButtonLink } from "@/components/bootcamp/BootcampTrackedButtonLink";
import { AccentGrid, CheckIcon, CompassIcon, ListingIcon, SectionShell } from "@/components/bootcamp/shared";
import { BOOTCAMP_HERO, BOOTCAMP_OVERVIEW, BOOTCAMP_PRIMARY_CTA_HREF, BOOTCAMP_SECONDARY_CTA_HREF } from "@/components/bootcamp/content";

export function HeroSection() {
  return (
    <SectionShell id="hero" className="pt-6 sm:pt-8 lg:pt-10">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.22),transparent_34%),linear-gradient(140deg,#0f3a67_0%,#155ea3_52%,#1f7fcb_100%)] px-6 py-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.16)] sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <AccentGrid className="-right-8 top-8 h-56 w-72 opacity-80" />
          <div className="relative max-w-2xl">
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              {BOOTCAMP_HERO.headline}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-sky-50/92 sm:text-lg">
              {BOOTCAMP_HERO.subheadline}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <BootcampTrackedButtonLink
                href={BOOTCAMP_PRIMARY_CTA_HREF}
                size="lg"
                className="rounded-full bg-white px-6 text-slate-950 hover:bg-slate-100"
                action="secure_your_spot"
                surface="bootcamp_hero"
                dedupeKey="bootcamp:cta:hero:secure"
              >
                {BOOTCAMP_HERO.primaryCta}
              </BootcampTrackedButtonLink>
              <BootcampTrackedButtonLink
                href={BOOTCAMP_SECONDARY_CTA_HREF}
                variant="secondary"
                size="lg"
                className="rounded-full border-white/25 bg-white/10 px-6 text-white hover:border-white/40 hover:bg-white/15"
                action="view_programme_roadmap"
                surface="bootcamp_hero"
                dedupeKey="bootcamp:cta:hero:roadmap"
              >
                {BOOTCAMP_HERO.secondaryCta}
              </BootcampTrackedButtonLink>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {BOOTCAMP_HERO.trustStrip.map((item) => (
                <div key={item} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-white/92 backdrop-blur-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-6 py-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:px-8 sm:py-8">
          <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_70%)]" />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">{BOOTCAMP_OVERVIEW.heading}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{BOOTCAMP_OVERVIEW.subheading}</p>
            <div className="mt-6 space-y-4">
              {BOOTCAMP_OVERVIEW.days.map((day, index) => (
                <div key={day.day} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                      {index === 0 ? <CompassIcon /> : index === 1 ? <CheckIcon /> : index === 2 ? <ListingIcon /> : index === 3 ? <ListingIcon /> : <CheckIcon />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">{day.day}</p>
                      <h2 className="mt-1 text-lg font-semibold text-slate-950">{day.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{day.copy}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </SectionShell>
  );
}

import { BootcampTrackedButtonLink } from "@/components/bootcamp/BootcampTrackedButtonLink";
import { BOOTCAMP_FINAL_CTA, BOOTCAMP_PRIMARY_CTA_HREF, BOOTCAMP_SECONDARY_CTA_HREF } from "@/components/bootcamp/content";
import { SectionShell } from "@/components/bootcamp/shared";

export function FinalCTASection() {
  return (
    <SectionShell id="final-cta" className="pt-16 sm:pt-20">
      <div className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#0f3a67_0%,#1a6eb7_55%,#36a2dd_100%)] px-6 py-10 text-center text-white shadow-[0_24px_80px_rgba(15,23,42,0.16)] sm:px-8 sm:py-12 lg:px-12">
        <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{BOOTCAMP_FINAL_CTA.heading}</h2>
        <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-sky-50/92 sm:text-lg">{BOOTCAMP_FINAL_CTA.copy}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <BootcampTrackedButtonLink
            href={BOOTCAMP_PRIMARY_CTA_HREF}
            size="lg"
            className="min-w-[220px] rounded-full bg-white px-6 text-slate-950 hover:bg-slate-100"
            action="join_pilot_cohort"
            surface="bootcamp_final_cta"
            dedupeKey="bootcamp:cta:final:join"
          >
            {BOOTCAMP_FINAL_CTA.primaryCta}
          </BootcampTrackedButtonLink>
          <BootcampTrackedButtonLink
            href={BOOTCAMP_SECONDARY_CTA_HREF}
            variant="secondary"
            size="lg"
            className="min-w-[220px] rounded-full border-white/25 bg-white/10 px-6 text-white hover:border-white/40 hover:bg-white/15"
            action="view_programme_roadmap"
            surface="bootcamp_final_cta"
            dedupeKey="bootcamp:cta:final:roadmap"
          >
            {BOOTCAMP_FINAL_CTA.secondaryCta}
          </BootcampTrackedButtonLink>
        </div>
      </div>
    </SectionShell>
  );
}

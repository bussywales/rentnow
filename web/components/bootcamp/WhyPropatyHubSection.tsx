import { BOOTCAMP_WHY_PROPATYHUB } from "@/components/bootcamp/content";
import { CompassIcon, RocketIcon, SectionIntro, SectionShell, ShieldIcon, UsersIcon } from "@/components/bootcamp/shared";

const icons = [CompassIcon, ShieldIcon, RocketIcon, UsersIcon] as const;

export function WhyPropatyHubSection() {
  return (
    <SectionShell id="why-propatyhub" className="pt-16 sm:pt-20">
      <SectionIntro heading={BOOTCAMP_WHY_PROPATYHUB.heading} subheading={BOOTCAMP_WHY_PROPATYHUB.subheading} />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {BOOTCAMP_WHY_PROPATYHUB.points.map((point, index) => {
          const Icon = icons[index];
          return (
            <article key={point.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                  <Icon />
                </span>
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-slate-950">{point.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{point.copy}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}

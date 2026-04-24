import { BOOTCAMP_HOW_IT_WORKS } from "@/components/bootcamp/content";
import { CalendarIcon, ListingIcon, RocketIcon, SectionIntro, SectionShell } from "@/components/bootcamp/shared";

const icons = [CalendarIcon, ListingIcon, RocketIcon] as const;

export function HowItWorksSection() {
  return (
    <SectionShell id="how-it-works" className="pt-16 sm:pt-20">
      <SectionIntro heading={BOOTCAMP_HOW_IT_WORKS.heading} subheading={BOOTCAMP_HOW_IT_WORKS.subheading} />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {BOOTCAMP_HOW_IT_WORKS.items.map((item, index) => {
          const Icon = icons[index];
          return (
            <article key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                <Icon />
              </span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}

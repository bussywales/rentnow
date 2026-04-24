import { BOOTCAMP_OVERVIEW } from "@/components/bootcamp/content";
import { CalendarIcon, ListingIcon, RocketIcon, SectionIntro, SectionShell, UsersIcon } from "@/components/bootcamp/shared";

const icons = [CalendarIcon, ListingIcon, ListingIcon, UsersIcon, RocketIcon] as const;

export function ProgrammeOverviewSection() {
  return (
    <SectionShell id="programme-overview" className="pt-16 sm:pt-20">
      <SectionIntro heading={BOOTCAMP_OVERVIEW.heading} subheading={BOOTCAMP_OVERVIEW.subheading} />
      <div className="mt-10 grid gap-4 lg:grid-cols-5">
        {BOOTCAMP_OVERVIEW.days.map((item, index) => {
          const Icon = icons[index];
          return (
            <article key={item.day} className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="absolute inset-x-5 top-0 h-1 rounded-full bg-gradient-to-r from-sky-600 to-sky-300" />
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700">
                <Icon />
              </span>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">{item.day}</p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.copy}</p>
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}

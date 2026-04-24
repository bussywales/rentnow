import { BOOTCAMP_AUDIENCE } from "@/components/bootcamp/content";
import { BriefcaseIcon, CompassIcon, ListingIcon, SectionIntro, SectionShell, UsersIcon } from "@/components/bootcamp/shared";

const icons = [CompassIcon, BriefcaseIcon, ListingIcon, UsersIcon] as const;

export function AudienceSection() {
  return (
    <SectionShell id="audience" className="pt-16 sm:pt-20">
      <SectionIntro heading="Who It Is For" align="center" />
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BOOTCAMP_AUDIENCE.map((item, index) => {
          const Icon = icons[index];
          return (
            <article key={item.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition-transform duration-200 hover:-translate-y-0.5">
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

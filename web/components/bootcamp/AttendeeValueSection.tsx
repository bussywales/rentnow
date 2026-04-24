import { BOOTCAMP_ATTENDEE_VALUE } from "@/components/bootcamp/content";
import { CheckIcon, ListingIcon, RocketIcon, SectionIntro, SectionShell, UsersIcon } from "@/components/bootcamp/shared";

const icons = [ListingIcon, CheckIcon, UsersIcon, RocketIcon] as const;

export function AttendeeValueSection() {
  return (
    <SectionShell id="attendee-value" className="pt-16 sm:pt-20">
      <div className="rounded-[2rem] bg-slate-950 px-6 py-10 text-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] sm:px-8 lg:px-10">
        <SectionIntro
          heading={BOOTCAMP_ATTENDEE_VALUE.heading}
          subheading={BOOTCAMP_ATTENDEE_VALUE.subheading}
        />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BOOTCAMP_ATTENDEE_VALUE.items.map((item, index) => {
            const Icon = icons[index];
            return (
              <article key={item.title} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-sky-100">
                  <Icon />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.copy}</p>
              </article>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}

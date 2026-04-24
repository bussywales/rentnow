import { BOOTCAMP_WHY_THIS_EXISTS } from "@/components/bootcamp/content";
import { AccentGrid, SectionIntro, SectionShell } from "@/components/bootcamp/shared";

export function WhyThisExistsSection() {
  return (
    <SectionShell id="why-this-exists" className="pt-16 sm:pt-20">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-6 py-10 shadow-sm sm:px-8 lg:px-10">
        <AccentGrid className="-left-10 bottom-0 h-40 w-60 opacity-60" />
        <div className="relative max-w-4xl">
          <SectionIntro
            label={BOOTCAMP_WHY_THIS_EXISTS.label}
            heading={BOOTCAMP_WHY_THIS_EXISTS.heading}
            subheading={BOOTCAMP_WHY_THIS_EXISTS.body}
          />
        </div>
      </div>
    </SectionShell>
  );
}

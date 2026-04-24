import { BrandLogo } from "@/components/branding/BrandLogo";
import { BootcampTrackedButtonLink } from "@/components/bootcamp/BootcampTrackedButtonLink";
import { BootcampTrackedTextLink } from "@/components/bootcamp/BootcampTrackedTextLink";
import { BOOTCAMP_NAV_ITEMS, BOOTCAMP_HERO, BOOTCAMP_PRIMARY_CTA_HREF } from "@/components/bootcamp/content";

export function HeaderNav() {
  return (
    <header id="top" className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6 lg:px-8">
        <BrandLogo variant="header" size="md" href="/bootcamp" />
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
          {BOOTCAMP_NAV_ITEMS.map((item) => (
            <BootcampTrackedTextLink
              key={item.label}
              href={item.href}
              className="transition hover:text-slate-950"
              action={`nav_${item.label.toLowerCase().replaceAll(" ", "_")}`}
              surface="bootcamp_header_nav"
              dedupeKey={`bootcamp:nav:desktop:${item.label}`}
            >
              {item.label}
            </BootcampTrackedTextLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <BootcampTrackedButtonLink
            href={BOOTCAMP_PRIMARY_CTA_HREF}
            size="md"
            className="rounded-full bg-sky-700 px-5 hover:bg-sky-800"
            action="secure_your_spot"
            surface="bootcamp_header"
            dedupeKey="bootcamp:cta:header:secure"
          >
            {BOOTCAMP_HERO.primaryCta}
          </BootcampTrackedButtonLink>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-slate-200/70 lg:hidden">
        <nav className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3 text-sm font-medium text-slate-600 sm:px-6 lg:px-8">
          {BOOTCAMP_NAV_ITEMS.map((item) => (
            <BootcampTrackedTextLink
              key={item.label}
              href={item.href}
              className="shrink-0 transition hover:text-slate-950"
              action={`nav_${item.label.toLowerCase().replaceAll(" ", "_")}`}
              surface="bootcamp_mobile_nav"
              dedupeKey={`bootcamp:nav:mobile:${item.label}`}
            >
              {item.label}
            </BootcampTrackedTextLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

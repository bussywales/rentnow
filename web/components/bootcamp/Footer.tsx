import { BrandLogo } from "@/components/branding/BrandLogo";
import { BOOTCAMP_FOOTER } from "@/components/bootcamp/content";
import { SectionShell } from "@/components/bootcamp/shared";

export function Footer() {
  return (
    <SectionShell id="footer" className="py-16 sm:py-20">
      <footer className="rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <BrandLogo variant="header" size="md" href="/bootcamp" />
            <p className="mt-3 text-sm text-slate-500">{BOOTCAMP_FOOTER.copyright}</p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm font-medium text-slate-600">
            {BOOTCAMP_FOOTER.links.map((link) => (
              <a key={link.label} href={link.href} className="transition hover:text-slate-950">
                {link.label}
              </a>
            ))}
          </nav>
        </div>
      </footer>
    </SectionShell>
  );
}

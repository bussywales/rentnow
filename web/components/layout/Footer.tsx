import { BrandLogo } from "@/components/branding/BrandLogo";
import { BRAND_NAME, BRAND_SUPPORT_EMAIL, BRAND_TAGLINE } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:py-6">
        <div className="flex flex-col gap-1.5">
          <BrandLogo variant="minimal" size="xs" />
          <p className="text-xs text-slate-500">{BRAND_NAME} · {BRAND_TAGLINE}</p>
        </div>

        <div className="flex flex-col gap-2 sm:hidden">
          <div className="grid grid-cols-3 gap-2">
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-sky-600"
              href="/help"
            >
              Help
            </a>
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-sky-600"
              href={`mailto:${BRAND_SUPPORT_EMAIL}`}
            >
              Contact
            </a>
            <a
              className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-sky-600"
              href="/legal"
            >
              Terms/Disclaimer
            </a>
          </div>
          <details className="group rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
            <summary className="cursor-pointer list-none rounded-md px-1 text-xs font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">
              <span className="inline-flex items-center gap-2">
                More
                <span
                  aria-hidden
                  className="transition-transform group-open:rotate-180"
                >
                  v
                </span>
              </span>
            </summary>
            <div className="mt-2 flex flex-col gap-1.5 text-xs">
              <a className="inline-flex min-h-9 items-center rounded-md px-2 text-slate-600 hover:bg-white hover:text-sky-600" href="/help/referrals">
                Referral FAQ
              </a>
              <a className="inline-flex min-h-9 items-center rounded-md px-2 text-slate-600 hover:bg-white hover:text-sky-600" href="/legal/disclaimer">
                Disclaimer
              </a>
              <span className="px-2 text-[11px] text-slate-400 whitespace-nowrap">
                Built by Xthetic Studio UK
              </span>
            </div>
          </details>
        </div>

        <div className="hidden items-center gap-3 sm:flex">
          <a className="hover:text-sky-600" href="/help">
            Help
          </a>
          <a className="hover:text-sky-600" href="/help/referrals">
            Referral FAQ
          </a>
          <a
            className="hover:text-sky-600"
            href={`mailto:${BRAND_SUPPORT_EMAIL}`}
          >
            Contact
          </a>
          <a className="hover:text-sky-600" href="/legal/disclaimer">
            Disclaimer
          </a>
          <span className="text-slate-400 whitespace-nowrap">Built by Xthetic Studio UK</span>
        </div>
      </div>
    </footer>
  );
}

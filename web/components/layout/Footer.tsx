import { BrandLogo } from "@/components/branding/BrandLogo";
import { BRAND_NAME, BRAND_SUPPORT_EMAIL, BRAND_TAGLINE } from "@/lib/brand";

export function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <BrandLogo variant="minimal" size="xs" />
          <p className="text-xs text-slate-500">{BRAND_NAME} · {BRAND_TAGLINE}</p>
        </div>
        <div className="flex items-center gap-3">
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
          <span className="text-slate-400">Built by Xthetic Studio UK</span>
        </div>
      </div>
    </footer>
  );
}

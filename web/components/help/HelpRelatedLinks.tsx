import Link from "next/link";

type HelpRelatedLink = {
  label: string;
  href: string;
  description?: string;
};

type HelpRelatedLinksProps = {
  links: HelpRelatedLink[];
};

export function HelpRelatedLinks({ links }: HelpRelatedLinksProps) {
  if (!links.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="help-related-links">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Related links</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm font-semibold text-slate-700 hover:text-slate-900">
              {link.label}
            </Link>
            {link.description ? (
              <p className="text-xs text-slate-500">{link.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

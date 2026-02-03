import Link from "next/link";

export type HelpBreadcrumb = {
  label: string;
  href?: string;
};

type HelpPageShellProps = {
  title: string;
  subtitle?: string;
  breadcrumbs?: HelpBreadcrumb[];
  children: React.ReactNode;
};

export function HelpPageShell({ title, subtitle, breadcrumbs, children }: HelpPageShellProps) {
  return (
    <div className="space-y-8" data-testid="help-page-shell">
      <header className="space-y-3">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-slate-800">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-slate-700">{crumb.label}</span>
                )}
                {index < breadcrumbs.length - 1 ? <span className="text-slate-300">/</span> : null}
              </span>
            ))}
          </nav>
        ) : null}
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin Help Centre</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
        </div>
      </header>
      {children}
    </div>
  );
}

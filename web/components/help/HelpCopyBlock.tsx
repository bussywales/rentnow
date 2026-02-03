import { PropsWithChildren } from "react";

type HelpCopyBlockProps = PropsWithChildren<{
  title: string;
}>;

export function HelpCopyBlock({ title, children }: HelpCopyBlockProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" data-testid="help-copy-block">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</p>
      <div className="mt-3 whitespace-pre-wrap rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
        {children}
      </div>
    </div>
  );
}

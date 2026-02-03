import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";

type HelpComingSoonProps = {
  title: string;
  description: string;
  links: { label: string; href: string; description?: string }[];
};

export function HelpComingSoon({ title, description, links }: HelpComingSoonProps) {
  return (
    <section
      className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6"
      data-testid="help-coming-soon"
    >
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <div className="mt-4">
        <HelpRelatedLinks links={links} />
      </div>
    </section>
  );
}

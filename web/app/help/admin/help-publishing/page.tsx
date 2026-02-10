import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function HelpPublishingGuidePage() {
  return (
    <div data-testid="help-admin-publishing-guide">
      <HelpPageShell
        title="Help publishing guide"
        subtitle="How admins publish new Help articles with MDX, images, and YouTube embeds using git."
        breadcrumbs={[
          { label: "Help Centre", href: "/help" },
          { label: "Admin Help Centre", href: "/help/admin" },
          { label: "Help publishing guide" },
        ]}
      >
        <section className="space-y-4">
          <HelpCallout variant="info" title="Publishing model (v1)">
            Help articles are file-based. Add or edit `.mdx` files in `web/content/help/`, then ship through a normal PR.
          </HelpCallout>

          <h2 className="text-lg font-semibold text-slate-900">Required frontmatter</h2>
          <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
{`---
title: Article title
description: One-line summary
role: public|agent|host|admin
category: Referrals
order: 1
tags: [referrals, onboarding]
updatedAt: 2026-02-10
---`}
          </pre>

          <h2 className="text-lg font-semibold text-slate-900">Supported components</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>{`<Callout type="info|warning|success">...`}</li>
            <li>{`<Steps> ... </Steps>`}</li>
            <li>{`<YouTube id="xxxxx" title="..." />`}</li>
            <li>{`<Image src="/help/file.svg" alt="..." caption="..." />`}</li>
          </ul>

          <HelpStepList
            steps={[
              "Create a new .mdx file in web/content/help/ with a kebab-case slug.",
              "Place image assets in web/public/help/ and reference them via /help/... paths.",
              "Use YouTube IDs only (not full URLs) in the <YouTube /> component.",
              "Run lint/test/build before opening a PR.",
            ]}
          />
        </section>
      </HelpPageShell>
    </div>
  );
}

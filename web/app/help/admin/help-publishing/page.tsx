import Link from "next/link";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function HelpPublishingGuidePage() {
  return (
    <div data-testid="help-admin-publishing-guide">
      <HelpPageShell
        title="Help publishing guide"
        subtitle="How admins publish new Help articles and tutorials using the internal editor or markdown, depending on the content type."
        breadcrumbs={[
          { label: "Help Centre", href: "/help" },
          { label: "Admin Help Centre", href: "/help/admin" },
          { label: "Help publishing guide" },
        ]}
      >
        <section className="space-y-4">
          <HelpCallout variant="info" title="Publishing model (v1)">
            Tutorial-style help is now authored in the internal editor at{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">/admin/help/tutorials</code>. Static help pages
            and playbooks can still be maintained as{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">.md</code> files in{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">web/docs/help/&lt;audience&gt;/</code> and
            shipped through a normal PR.
          </HelpCallout>

          <h2 className="text-lg font-semibold text-slate-900">Use the tutorial editor when</h2>
          <HelpStepList
            steps={[
              "You need a create/edit workflow for an operator tutorial without touching files directly.",
              "The tutorial needs audience and visibility controls (public tenant/landlord/agent or internal admin/ops).",
              "The tutorial includes an optional YouTube walkthrough and should support draft, publish, and unpublish states.",
            ]}
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Open{" "}
            <Link href="/admin/help/tutorials" className="font-semibold text-slate-900 underline underline-offset-4">
              /admin/help/tutorials
            </Link>{" "}
            to create or edit tutorials. The editor accepts normal YouTube URLs, shows the same click-to-load preview
            card used on published help pages, and publishes to the correct help route based on audience and visibility.
            You can also reach it from the admin workspace sidebar under{" "}
            <span className="font-semibold text-slate-900">Help Tutorials</span>.
          </div>

          <h2 className="text-lg font-semibold text-slate-900">Use file-based help when</h2>
          <p className="text-sm text-slate-700">
            You are updating durable static runbooks, shared troubleshooting pages, or other help content that still belongs in the repo as markdown.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Required frontmatter for file-based help</h2>
          <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
{`---
title: Article title
description: One-line summary
order: 1
updated_at: 2026-03-26
---`}
          </pre>

          <h2 className="text-lg font-semibold text-slate-900">Supported markdown components</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>{`<Callout type="info|warning|success">...`}</li>
            <li>{`<Steps> ... </Steps>`}</li>
            <li>{`<YouTube id="xxxxx" title="..." />`}</li>
            <li>{`<Image src="/help/file.svg" alt="..." caption="..." />`}</li>
          </ul>

          <HelpStepList
            steps={[
              "Use /admin/help/tutorials for new tutorial pages that need audience, visibility, draft/publish, or video controls.",
              "Create a new .md file in web/docs/help/<audience>/ only for static file-backed help pages.",
              "Place image assets in web/public/help/ and reference them via /help/... paths.",
              "Use YouTube IDs only (not full URLs) in the <YouTube /> component.",
              "Published help videos now render as thumbnail-first cards and only load the live YouTube player after a click.",
              "Run lint/test/build before opening a PR.",
            ]}
          />
        </section>
      </HelpPageShell>
    </div>
  );
}

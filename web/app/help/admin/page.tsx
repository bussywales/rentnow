import Link from "next/link";

import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";

export const dynamic = "force-dynamic";

export default function AdminHelpPage() {
  return (
    <div data-testid="help-admin-landing">
      <HelpPageShell
        title="Admin Help Centre"
        subtitle="Guides for reviewing listings, managing users, featuring properties, and handling support tasks."
        breadcrumbs={[{ label: "Help Centre", href: "/help" }, { label: "Admin Help Centre" }]}
      >
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Start here</h2>
            <p className="mt-2 text-sm text-slate-600">
              Use the Admin navigation for reviews, user management, and analytics. The Help drawer in the header links
              to this playbook at any time.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>Admin tools live under /admin. Review queue and listings live on the Review and Listings tabs.</li>
              <li>Use consistent reason notes on every action to keep audits clean.</li>
              <li>Escalations go to engineering only after checklist steps are completed.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Most common tasks</h2>
            <div className="mt-3 grid gap-3" data-testid="help-common-tasks">
              {
                [
                  { label: "Listings review workflow", href: "/help/admin/listings/review-workflow" },
                  { label: "Feature a listing", href: "/help/admin/listings/featured" },
                  { label: "Publish a product update", href: "/help/admin/product-updates" },
                  { label: "Publish Help articles", href: "/help/admin/help-publishing" },
                  { label: "Check user status", href: "/help/admin/users" },
                  { label: "Featured performance & missed demand", href: "/help/admin/analytics" },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                  >
                    {item.label}
                  </Link>
                ))
              }
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Quick links</h2>
            <div className="grid gap-4 sm:grid-cols-2" data-testid="help-quick-links">
              <HelpRelatedLinks
                links={[
                  { label: "Listings hub", href: "/help/admin/listings" },
                  { label: "Review workflow", href: "/help/admin/listings/review-workflow" },
                  { label: "Statuses", href: "/help/admin/listings/statuses" },
                ]}
              />
              <HelpRelatedLinks
                links={[
                  { label: "Featured inventory", href: "/help/admin/listings/featured" },
                  { label: "Product updates", href: "/help/admin/product-updates" },
                  { label: "Analytics", href: "/help/admin/analytics" },
                ]}
              />
              <HelpRelatedLinks
                links={[
                  { label: "User management", href: "/help/admin/users" },
                  { label: "Support playbooks", href: "/help/admin/support-playbooks" },
                ]}
              />
            </div>
          </div>
          <HelpCallout variant="warn" title="Escalation checklist">
            <ul className="list-disc space-y-2 pl-4 text-sm">
              <li>Capture user ID, property ID, and a timestamp of the action.</li>
              <li>Include a screenshot of the current UI state and any error message.</li>
              <li>Note the exact steps you took before the issue appeared.</li>
            </ul>
          </HelpCallout>
        </section>
      </HelpPageShell>
    </div>
  );
}

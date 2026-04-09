import Link from "next/link";
import { RoleHelpIndex } from "@/components/help/RoleHelpPage";

export const dynamic = "force-dynamic";

export default function AgentRoleHelpPage() {
  return (
    <div className="space-y-6">
      <RoleHelpIndex
        role="agent"
        title="Agent Help Centre"
        subtitle="Run portfolio workflows at scale: listings, leads, featured campaigns, property-prep requests, and operational quality."
      />
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" data-testid="agent-move-ready-card">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Pilot access</p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">Move &amp; Ready Services</h2>
        <p className="mt-2 text-sm text-slate-600">
          Agents can submit the same narrow property-prep requests for delegated portfolios. The
          flow stays limited to cleaning, fumigation, and minor repairs.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/host/services" className="text-sm font-semibold text-sky-700">
            Open prep requests
          </Link>
          <Link href="/help/agent/services" className="text-sm font-semibold text-slate-700">
            Read the agent guide
          </Link>
        </div>
      </section>
    </div>
  );
}

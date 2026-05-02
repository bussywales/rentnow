import { HelpCallout } from "@/components/help/HelpCallout";
import { HelpCopyBlock } from "@/components/help/HelpCopyBlock";
import { HelpPageShell } from "@/components/help/HelpPageShell";
import { HelpRelatedLinks } from "@/components/help/HelpRelatedLinks";
import { HelpStepList } from "@/components/help/HelpStepList";

export const dynamic = "force-dynamic";

export default function AdminUsersHelpPage() {
  return (
    <HelpPageShell
      title="User management"
      subtitle="Role corrections, account actions, and support notes for user records."
      breadcrumbs={[
        { label: "Help Centre", href: "/help" },
        { label: "User management" },
      ]}
    >
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">When to use role correction</h2>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">
          <li>A user picked the wrong initial role and cannot reach the correct workspace.</li>
          <li>An onboarding record is stuck in the wrong role or incomplete state.</li>
          <li>Support needs to restore a broken admin, host, or tenant access path.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Do not use it for</h2>
        <HelpCallout variant="warn" title="Role changes are corrective, not self-service switching">
          <ul className="list-disc space-y-2 pl-5 text-sm">
            <li>Do not treat role changes as a casual multi-role toggle.</li>
            <li>Do not move a user between roles unless the original assignment is wrong or broken.</li>
            <li>Do not promise self-service role switching. The product still blocks that path.</li>
          </ul>
        </HelpCallout>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Correction checklist</h2>
        <HelpStepList
          steps={[
            "Confirm the user email, current role, and the workspace they should actually access.",
            "Record a clear reason before saving any admin role change.",
            "After the correction, confirm onboarding is complete and the user lands on the expected workspace.",
            "Recheck any verification or listing-management expectations tied to the new role.",
          ]}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Expected routing after correction</h2>
        <HelpCopyBlock title="Workspace routing">
          Tenant → /tenant/home

          Landlord or agent → /home

          Admin → /admin
        </HelpCopyBlock>
      </section>

      <HelpRelatedLinks
        links={[
          { label: "Verification playbook", href: "/help/admin/support-playbooks/verification" },
          { label: "Support playbooks", href: "/help/admin/support-playbooks" },
        ]}
      />
    </HelpPageShell>
  );
}

export const dynamic = "force-dynamic";

export default function AdminUsersHelpPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Admin &amp; Ops</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">User management</h1>
        <p className="mt-2 text-sm text-slate-600">
          Keep role changes auditable and provide clear reasons for account actions.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Role updates</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>Always include a short reason when changing roles.</li>
          <li>Use Admin roles sparingly and review quarterly.</li>
          <li>Confirm onboarding status before escalations.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">Account actions</h2>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>Send password resets for access issues first.</li>
          <li>Use delete/deactivate only with clear user confirmation.</li>
          <li>Keep notes in the user record for future audits.</li>
        </ul>
      </section>
    </div>
  );
}

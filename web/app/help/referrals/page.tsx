import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ReferralHelpPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Help Centre</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Referral FAQ</h1>
        <p className="mt-2 text-sm text-slate-600">
          Understand active referrals, rewards, tiers, milestones, and country-based cashout rules.
        </p>
      </div>

      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">1. What counts as an Active referral?</h2>
          <p className="mt-1 text-sm text-slate-700">
            A referral becomes <span className="font-semibold">Active</span> after at least one verified
            paid event that qualifies for referral rewards (PAYG listing payment, featured purchase,
            and eligible subscription payments).
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">2. When do I earn credits?</h2>
          <p className="mt-1 text-sm text-slate-700">
            Credits are issued when a referred user completes a qualifying verified paid event and your
            referral program settings allow rewards at that level.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">3. What can credits be used for?</h2>
          <p className="mt-1 text-sm text-slate-700">
            PropatyHub Credits can be used for publishing listings and featuring listings on-platform.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">4. Cashout: why it may not be available in my country</h2>
          <p className="mt-1 text-sm text-slate-700">
            Cashout is configured per jurisdiction. Even when referrals are active, cashout may remain
            disabled due to country policy, conversion settings, or eligible reward-source rules.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">5. Tier badges: how they’re calculated</h2>
          <p className="mt-1 text-sm text-slate-700">
            Tier badges (Bronze, Silver, Gold, Platinum) are based on your
            <span className="font-semibold"> Active referral count</span>, not total invites.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">6. Milestones: how bonus credits work</h2>
          <p className="mt-1 text-sm text-slate-700">
            Milestones award one-time bonus credits when your Active referral count reaches configured
            thresholds. Claims are idempotent, so each milestone is claimable only once per user.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-900">7. Fraud/abuse policy</h2>
          <p className="mt-1 text-sm text-slate-700">
            We monitor for duplicate, suspicious, or manipulated activity. Abusive behavior may result in
            withheld rewards, reversed credits, or account restrictions.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/referrals" className="font-semibold text-slate-900 underline underline-offset-4">
          Agent referrals dashboard
        </Link>
        <Link href="/admin/settings/referrals" className="font-semibold text-slate-900 underline underline-offset-4">
          Admin referral settings
        </Link>
        <Link href="/help" className="font-semibold text-slate-900 underline underline-offset-4">
          Help home
        </Link>
      </div>
    </div>
  );
}

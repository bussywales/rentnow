import Link from "next/link";

export const dynamic = "force-dynamic";

export default function ReferralHelpPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Help Centre</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Referral FAQ</h1>
        <p className="mt-2 text-sm text-slate-600">
          Credits-first referrals, country-based cashout rules, and payout safety controls.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">How referral rewards work</h2>

        <div className="space-y-3 text-sm text-slate-700">
          <div>
            <p className="font-semibold text-slate-900">Are rewards cash by default?</p>
            <p>
              No. Rewards are issued as <span className="font-semibold">PropatyHub Credits</span> by
              default. No money moves by default.
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">What can I use credits for?</p>
            <p>
              Referral credits can be used for <span className="font-semibold">PAYG listing fees</span>{" "}
              and <span className="font-semibold">Featured listing credits</span>.
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Is cashout available everywhere?</p>
            <p>
              Cashout depends on country policy. Some jurisdictions have cashout disabled while legal,
              compliance, and operations policies are being finalized.
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">How deep does the referral tree go?</p>
            <p>
              Referral depth is configurable by admins up to <span className="font-semibold">5 levels</span>.
              Rewards are only issued on enabled levels and verified paid events.
            </p>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Can rewards be withheld or reversed?</p>
            <p>
              Yes. Fraud prevention rules apply. Suspicious activity, self-referral abuse, duplicate events,
              or policy violations may trigger withholding, rejection, or reversal before payout.
            </p>
          </div>
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

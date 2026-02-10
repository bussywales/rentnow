import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

function FaqItem(props: {
  id: string;
  question: string;
  children: ReactNode;
}) {
  return (
    <article id={props.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">{props.question}</h3>
      <div className="mt-2 space-y-2 text-sm text-slate-700">{props.children}</div>
    </article>
  );
}

export default function ReferralHelpPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Help Centre</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Referral FAQ</h1>
        <p className="mt-2 text-sm text-slate-600">
          Simple guidance for Agents/Hosts and Admins: how Active referrals work, how credits are
          earned, and how country cashout rules apply.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-900">Jump to section</p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <a href="#for-agents-hosts" className="font-semibold text-slate-900 underline underline-offset-4">
            For Agents &amp; Hosts
          </a>
          <a href="#admins" className="font-semibold text-slate-900 underline underline-offset-4">
            For Admins
          </a>
        </div>
      </section>

      <section id="for-agents-hosts" className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">For Agents &amp; Hosts</h2>

        <FaqItem id="agent-active-referral" question="1. What counts as an Active referral?">
          <p>
            An invite becomes <span className="font-semibold">Active</span> only after the person
            completes at least one verified paid event that qualifies for referral rewards.
          </p>
          <p>Example: they pay for a PAYG listing fee and the payment is verified.</p>
        </FaqItem>

        <FaqItem id="agent-earn-credits" question="2. When do I earn credits?">
          <p>
            You earn credits when a qualifying verified paid event is recorded for your referral,
            and the current referral settings allow rewards for that event/depth.
          </p>
          <p>
            Credits are not awarded at sign-up time. The trigger is a verified paid event.
          </p>
        </FaqItem>

        <FaqItem id="agent-credit-usage" question="3. What can credits be used for?">
          <p>
            Credits are primarily for on-platform spend, including publishing listings and featuring
            listings.
          </p>
        </FaqItem>

        <FaqItem id="agent-tiers" question="4. How do tiers work?">
          <p>
            Tiers are based on <span className="font-semibold">Active referrals</span>, not total
            invites.
          </p>
          <p>
            Example: if Silver starts at 5 Active referrals and Gold starts at 15, then 7 Active
            referrals means you are in Silver and need 8 more to reach Gold.
          </p>
        </FaqItem>

        <FaqItem id="agent-tier-badges" question="5. What do tier badges mean?">
          <p>
            Tier badges (Bronze, Silver, Gold, Platinum) are status markers based on your Active
            referral count.
          </p>
          <p>
            They show growth level only. Tier badges do not directly represent cash value.
          </p>
        </FaqItem>

        <FaqItem id="agent-milestones" question="6. How do milestones work?">
          <p>
            Milestones are one-time bonus credit unlocks at specific Active referral thresholds.
          </p>
          <p>
            Example: a 10-Active milestone with +5 credits is awarded once when you hit 10 Active
            referrals. If your workspace requires claiming, use the Claim button in your dashboard.
          </p>
        </FaqItem>

        <FaqItem id="agent-leaderboard" question="7. How is the leaderboard calculated?">
          <p>
            Leaderboard rank is based on Active referrals only, not earnings. You can switch between
            This month and All time when both views are enabled.
          </p>
        </FaqItem>

        <FaqItem id="agent-privacy" question="8. Can others see my referral activity?">
          <p>
            Top leaderboard lists show masked names, tier badge, and Active referral count only.
            Credits, earnings, and cash amounts are never shown.
          </p>
          <p>You can opt out of leaderboard visibility from your referrals dashboard.</p>
        </FaqItem>

        <FaqItem id="agent-improve-tier" question="9. How do I improve my tier?">
          <p>
            Focus on helping invited users become Active referrals. The fastest path is quality
            invites who complete verified paid events.
          </p>
        </FaqItem>

        <FaqItem id="agent-cashout-country" question="10. Why can't I cash out in my country?">
          <p>
            Cashout is controlled by country policy. Some countries may have cashout disabled, and
            some reward sources may be excluded from cashout eligibility.
          </p>
          <p>
            Even if you earn credits, cashout can remain unavailable until that jurisdiction policy
            is enabled.
          </p>
        </FaqItem>

        <FaqItem id="agent-cashout-rate" question="11. How is cashout rate calculated?">
          <p>
            Admin can configure either:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Fixed amount per credit, or</li>
            <li>Percent of PAYG listing fee.</li>
          </ul>
          <p>
            In both modes, the platform applies the configured per-credit amount during cashout.
          </p>
        </FaqItem>

        <FaqItem id="agent-fraud" question="12. Fraud/abuse policy summary">
          <p>
            We monitor suspicious patterns, including duplicate or manipulated activity. Abuse can
            lead to withheld rewards, reversed credits, payout blocking, or account restrictions.
          </p>
        </FaqItem>
      </section>

      <section id="admins" className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">For Admins</h2>

        <FaqItem id="admin-enable-disable" question="1. How do I enable or disable the referral program?">
          <p>
            Go to Admin Settings → Referrals and use the Program toggle. Save changes to apply them
            platform-wide.
          </p>
        </FaqItem>

        <FaqItem id="admin-depth" question="2. How do depth levels work?">
          <p>
            Depth controls how many referral levels can receive rewards. Higher depth can increase
            payout exposure because more levels may qualify.
          </p>
        </FaqItem>

        <FaqItem id="admin-tier-thresholds" question="3. How should I set tier thresholds?">
          <p>
            Tier thresholds should represent Active referrals and remain ascending (Bronze → Silver
            → Gold → Platinum).
          </p>
          <p>Keep Bronze at 0 as your baseline entry tier.</p>
        </FaqItem>

        <FaqItem id="admin-leaderboard-controls" question="4. How should I configure leaderboard visibility?">
          <p>
            Use leaderboard toggles to control whether ranking is enabled, whether it is publicly
            visible to agents, and whether monthly/all-time windows are available.
          </p>
          <p>
            Keep messaging focused on status and growth rather than payouts.
          </p>
        </FaqItem>

        <FaqItem id="admin-milestones" question="5. How should I set milestones, and what do agents see?">
          <p>
            Configure milestone name, threshold (Active referrals), bonus credits, and enabled
            state. Thresholds must be unique.
          </p>
          <p>
            Agents see locked/claimable/claimed states in their dashboard, plus next milestone
            progress and claim action where applicable.
          </p>
        </FaqItem>

        <FaqItem id="admin-jurisdictions" question="6. How do jurisdiction policies affect cashout?">
          <p>
            Jurisdiction policy controls whether payouts and conversion are enabled, which reward
            sources are cashout-eligible, and how cashout rates are configured.
          </p>
          <p>Country policy can allow credits while still blocking cashout.</p>
        </FaqItem>

        <FaqItem id="admin-payout-queue" question="7. How should I interpret payout queue and manual approval?">
          <p>
            The payouts queue shows submitted cashout requests and status transitions. Manual
            approval gives ops a review checkpoint before payment completion.
          </p>
        </FaqItem>
      </section>

      <footer className="flex flex-wrap gap-3 text-sm">
        <Link href="/dashboard/referrals" className="font-semibold text-slate-900 underline underline-offset-4">
          Agent referrals dashboard
        </Link>
        <Link href="/help/agents#referrals" className="font-semibold text-slate-900 underline underline-offset-4">
          Agent help referrals section
        </Link>
        <Link href="/admin/settings/referrals" className="font-semibold text-slate-900 underline underline-offset-4">
          Admin referral settings
        </Link>
        <Link href="/help" className="font-semibold text-slate-900 underline underline-offset-4">
          Help home
        </Link>
      </footer>
    </div>
  );
}

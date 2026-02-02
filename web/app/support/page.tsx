import Link from "next/link";
import { appVersion, releaseDate, releaseNotes } from "@/lib/version";
import SupportContactForm from "@/components/support/SupportContactForm";
import { SupportFaqAccordion } from "@/components/support/SupportFaqAccordion";
import { getProfile } from "@/lib/auth";
import { normalizeRole } from "@/lib/roles";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const quickHelpItems = [
  {
    title: "Can’t log in?",
    description: "Use “Forgot password” on the login page or contact us and we’ll reset it.",
  },
  {
    title: "Need to reach a host?",
    description: "Use the listing contact button so your messages stay in-app and secure.",
  },
  {
    title: "Report a listing",
    description: "Share the listing link and what looks wrong. We’ll review promptly.",
  },
];

const commonTopics = [
  "Booking/viewing issues",
  "Saved searches",
  "Contacting a landlord",
  "Account/login",
  "Report a listing",
];

const popularTopics = [
  {
    title: "Account access",
    description: "Reset a password, update your email, or verify your profile.",
  },
  {
    title: "Viewing requests",
    description: "Reschedule a visit or troubleshoot viewing confirmations.",
  },
  {
    title: "Listing quality",
    description: "Report inaccurate details or flag duplicate listings fast.",
  },
  {
    title: "Payments & plans",
    description: "Questions about subscriptions, receipts, or billing updates.",
  },
  {
    title: "Saved searches",
    description: "Adjust alerts, pause notifications, or change filters.",
  },
  {
    title: "Safety help",
    description: "Report safety concerns and get next-step guidance.",
  },
];

const faqItems = [
  {
    question: "How soon will I hear back?",
    answer: "Most requests receive a response within 24 hours on business days.",
  },
  {
    question: "What details help support resolve my issue fastest?",
    answer: "Include the listing link, city, dates, screenshots, and the email on your account.",
  },
  {
    question: "How do I report a listing?",
    answer: "Share the listing link and what looks wrong so the team can investigate quickly.",
  },
  {
    question: "Where can I manage saved searches?",
    answer: "Open your dashboard saved searches to edit alerts or pause notifications.",
  },
  {
    question: "Can I change or cancel a viewing?",
    answer: "Update the viewing request if available, or message support with the preferred times.",
  },
  {
    question: "How do I reach a host?",
    answer: "Use the in-app message thread to keep conversations secure and logged.",
  },
];

export default async function SupportPage() {
  const profile = hasServerSupabaseEnv() ? await getProfile() : null;
  const normalizedRole = normalizeRole(profile?.role);
  const isAdmin = normalizedRole === "admin";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Support</p>
        <h1 className="text-3xl font-semibold text-slate-900">We’re here to help</h1>
        <p className="text-sm text-slate-500">
          Tell us what you need and we’ll get back to you with next steps.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Popular topics</h2>
            <p className="text-sm text-slate-500">
              Start with a common request and we’ll route you to the right help.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {popularTopics.map((topic) => (
                <div
                  key={topic.title}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-sm font-semibold text-slate-900">{topic.title}</p>
                  <p className="text-sm text-slate-500">{topic.description}</p>
                </div>
              ))}
            </div>
          </div>

          <SupportFaqAccordion items={faqItems} />

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Contact support</h2>
            <p className="text-sm text-slate-500">
              Share a few details so we can route your request quickly.
            </p>
            <div className="mt-4">
              <SupportContactForm />
            </div>
          </div>
        </div>

        {isAdmin ? (
          <div
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            data-testid="support-admin-status"
          >
            <h2 className="text-base font-semibold text-slate-900">Admin status</h2>
            <p className="text-sm text-slate-600">
              Internal release notes and runtime checks. Version {appVersion} • Released {releaseDate}
            </p>
            <div
              className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
              data-testid="support-release-notes"
            >
              <h3 className="text-sm font-semibold text-slate-900">Release notes</h3>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-slate-700">
                {releaseNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
            <Link href="/api/debug/env" className="mt-3 inline-flex text-sm font-semibold text-sky-700">
              Runtime env check
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              data-testid="support-quick-help"
            >
              <h2 className="text-base font-semibold text-slate-900">Quick help</h2>
              <p className="text-sm text-slate-500">
                Start here for the most common questions.
              </p>
              <div className="mt-4 grid gap-3">
                {quickHelpItems.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-600">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              data-testid="support-common-topics"
            >
              <h2 className="text-base font-semibold text-slate-900">Common topics</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {commonTopics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-700"
                  >
                    {topic}
                  </span>
                ))}
              </div>
              <p
                className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
                data-testid="support-response-time"
              >
                Expected response time: within 24 hours on business days.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

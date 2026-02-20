import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About PropatyHub",
  description:
    "Learn how PropatyHub is re-imagining renting, shortlets, and property discovery with clarity, trust, and practical local relevance.",
};

const BELIEFS = [
  "Clarity beats clutter. If a listing isn’t clear, it isn’t helpful.",
  "Trust is a feature. Verification and reliability signals should be obvious — not hidden.",
  "Local realities matter. The best platforms adapt to real-world needs, not assumptions.",
  "Speed matters. Fast pages, optimised images, and mobile-first flows aren’t optional.",
  "A global product can start locally. We build for Nigeria first — then scale worldwide without rewriting the foundation.",
];

const DIFFERENTIATORS = [
  "Shortlets that feel bookable: availability-aware search, map-first exploration, and pricing that’s easy to compare.",
  "Practical filters: power backup, borehole water, security/gated, and more — the stuff people actually ask first.",
  "Trust signals: verified hosts, identity checks, booking mode clarity, and consistent listing standards.",
  "Cleaner decision-making: fewer distractions, better information hierarchy, calm UI that helps you choose.",
];

const TRUST_ITEMS = [
  "Listing quality standards (photos, accuracy, amenity proof)",
  "Verification and trust signals",
  "Clearer cancellation and booking rules",
  "Reporting and moderation flows",
];

export default function AboutPage() {
  return (
    <main className="bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            About PropatyHub
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Renting, shortlets, and property discovery — re-imagined.
          </h1>
          <p className="mt-4 max-w-3xl text-base text-slate-600 sm:text-lg">
            PropatyHub helps people find the right place faster, with clearer
            information, better trust signals, and a smoother booking journey —
            from quick short stays to longer-term rentals.
          </p>
          <p className="mt-4 text-sm font-semibold text-slate-700">
            Our promise: less noise, more confidence.
          </p>
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">Our story</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            PropatyHub was built from a simple observation: property search
            often feels stressful, fragmented, and inconsistent — especially
            across emerging markets where power, water, security, and
            reliability matter as much as location.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            We’re building a platform that respects how people actually live and
            travel, with practical filters, transparent pricing, and trust-first
            product design.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Vision</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              To become the most trusted global platform for discovering and
              booking homes — anywhere.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Mission</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              To make renting and short stays simple, transparent, and safe by
              combining great design, trustworthy listings, and modern booking
              tools.
            </p>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            What we believe
          </h2>
          <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-600 sm:text-base">
            {BELIEFS.map((belief) => (
              <li key={belief}>• {belief}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            What makes PropatyHub different
          </h2>
          <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-600 sm:text-base">
            {DIFFERENTIATORS.map((point) => (
              <li key={point}>• {point}</li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">For guests</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Find stays that match your needs, not just the photos. Compare
              pricing clearly, explore by map area, save favourites, and book
              with confidence.
            </p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              For hosts and agents
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              List once, reach the right audience, and manage enquiries more
              efficiently. We’re building tools that help you present listings
              clearly and convert interest into bookings.
            </p>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Trust, safety, and quality
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            We’re actively improving:
          </p>
          <ul className="mt-2 space-y-2 text-sm leading-7 text-slate-600 sm:text-base">
            {TRUST_ITEMS.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">
            Where we’re going
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
            PropatyHub is designed to scale globally. Our roadmap focuses on:
            better discovery (smarter search + places), faster performance
            (image optimisation + caching), stronger trust (verification layers,
            reviews, safety checks), better booking workflows (pricing clarity,
            cancellations, messaging).
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold text-slate-900">Contact</h2>
          <a
            className="mt-3 inline-flex text-sm font-semibold text-sky-700 underline underline-offset-4"
            href="mailto:support@propatyhub.com"
          >
            support@propatyhub.com
          </a>
        </section>
      </div>
    </main>
  );
}

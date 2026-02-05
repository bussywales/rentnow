import Image from "next/image";
import { getAgentStorefrontData } from "@/lib/agents/agent-storefront.server";
import AgentStorefrontListingsClient from "@/components/agents/AgentStorefrontListingsClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: { slug: string };
};

const FALLBACK_AVATAR =
  "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=80";

const NOT_AVAILABLE_COPY = {
  global_disabled: {
    title: "Agent storefronts are currently unavailable",
    description:
      "We’ve temporarily paused public agent pages. Please check back soon or browse listings instead.",
  },
  agent_disabled: {
    title: "This storefront is not available",
    description:
      "This agent has chosen to hide their public storefront right now.",
  },
  not_found: {
    title: "This storefront is not available",
    description:
      "We couldn’t find that agent storefront. Double-check the link and try again.",
  },
} as const;

export default async function AgentStorefrontPage({ params }: PageProps) {
  const data = await getAgentStorefrontData(params.slug);

  if (!data.available || !data.agent) {
    const reason = data.reason ?? "not_found";
    const copy = NOT_AVAILABLE_COPY[reason];
    return (
      <div
        className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-12"
        data-testid="agent-storefront-unavailable"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Agents</p>
        <h1 className="text-3xl font-semibold text-slate-900">{copy.title}</h1>
        <p className="text-sm text-slate-600">{copy.description}</p>
      </div>
    );
  }

  const { agent, listings } = data;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative h-20 w-20 overflow-hidden rounded-full bg-slate-100">
              <Image
                src={agent.avatarUrl || FALLBACK_AVATAR}
                alt={agent.name}
                fill
                className="object-cover"
                sizes="80px"
                priority={false}
              />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Agent</p>
              <h1 className="text-3xl font-semibold text-slate-900">{agent.name}</h1>
              {agent.bio ? (
                <p className="mt-2 max-w-2xl text-sm text-slate-600">{agent.bio}</p>
              ) : (
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  Helping tenants and buyers find the right home across PropatyHub.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Listings</h2>
            <p className="text-sm text-slate-600">
              Live homes currently represented by this agent.
            </p>
          </div>
        </div>

        {listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            No live listings yet.
          </div>
        ) : (
          <AgentStorefrontListingsClient listings={listings} />
        )}
      </section>
    </div>
  );
}

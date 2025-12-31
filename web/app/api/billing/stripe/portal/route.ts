import { NextResponse } from "next/server";
import { requireRole } from "@/lib/authz";
import { getStripeClient } from "@/lib/billing/stripe";
import { getSiteUrl } from "@/lib/env";
import { logFailure } from "@/lib/observability";

const routeLabel = "/api/billing/stripe/portal";

type PlanRow = {
  stripe_customer_id?: string | null;
};

export async function POST(request: Request) {
  const startTime = Date.now();
  const auth = await requireRole({
    request,
    route: routeLabel,
    startTime,
    roles: ["landlord", "agent"],
  });
  if (!auth.ok) return auth.response;

  const { data: planRow, error } = await auth.supabase
    .from("profile_plans")
    .select("stripe_customer_id")
    .eq("profile_id", auth.user.id)
    .maybeSingle();

  if (error) {
    logFailure({ request, route: routeLabel, status: 500, startTime, error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const customerId = (planRow as PlanRow | null)?.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ error: "No Stripe customer" }, { status: 404 });
  }

  const stripe = getStripeClient();
  const siteUrl = await getSiteUrl();
  if (!siteUrl) {
    return NextResponse.json({ error: "Unable to resolve site URL" }, { status: 500 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl}/dashboard?stripe=portal-return`,
  });

  return NextResponse.json({ url: session.url });
}

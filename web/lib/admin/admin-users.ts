import { normalizePlanTier, type PlanTier } from "@/lib/plans";
import { normalizeRole, type KnownRole } from "@/lib/roles";

export type AdminUserStatus = "active" | "pending" | "incomplete" | "missing";

export type AdminUsersQuery = {
  q: string | null;
  role: "all" | KnownRole;
  status: "all" | AdminUserStatus;
  plan: "all" | PlanTier;
  page: number;
  pageSize: number;
};

export type AdminUserRow = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  fullName: string | null;
  role: string | null;
  onboardingCompleted: boolean | null;
  planTier: string | null;
  maxListingsOverride: number | null;
  validUntil: string | null;
  billingNotes: string | null;
  billingSource: string | null;
  stripeStatus: string | null;
  stripeCurrentPeriodEnd: string | null;
  pendingCount: number;
  profileMissing: boolean;
};

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export const DEFAULT_ADMIN_USERS_QUERY: AdminUsersQuery = {
  q: null,
  role: "all",
  status: "all",
  plan: "all",
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

type ParamBag = Record<string, string | string[] | undefined>;

function readParam(params: ParamBag, key: string) {
  const value = params[key];
  if (Array.isArray(value)) return value[value.length - 1] ?? null;
  return value ?? null;
}

const parsePageValue = (value: string | null, fallback: number) => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export function parseAdminUsersQuery(
  params: ParamBag | URLSearchParams
): AdminUsersQuery {
  const bag: ParamBag =
    params instanceof URLSearchParams
      ? Array.from(params.entries()).reduce<ParamBag>((acc, [key, value]) => {
          const existing = acc[key];
          if (existing === undefined) {
            acc[key] = value;
          } else if (Array.isArray(existing)) {
            existing.push(value);
            acc[key] = existing;
          } else {
            acc[key] = [existing, value];
          }
          return acc;
        }, {})
      : params;

  const q = (readParam(bag, "q") ?? "").trim() || null;

  const roleRaw = (readParam(bag, "role") ?? "").toLowerCase();
  const roleNormalized = normalizeRole(roleRaw);
  const role: AdminUsersQuery["role"] = roleNormalized ?? "all";

  const statusRaw = (readParam(bag, "status") ?? "").toLowerCase();
  const status: AdminUsersQuery["status"] =
    statusRaw === "active" ||
    statusRaw === "pending" ||
    statusRaw === "incomplete" ||
    statusRaw === "missing"
      ? statusRaw
      : "all";

  const planRaw = (readParam(bag, "plan") ?? "").toLowerCase();
  const plan: AdminUsersQuery["plan"] =
    planRaw === "free" ||
    planRaw === "starter" ||
    planRaw === "pro" ||
    planRaw === "tenant_pro"
      ? normalizePlanTier(planRaw)
      : "all";

  const page = parsePageValue(readParam(bag, "page"), 1);
  const pageSizeRaw = parsePageValue(readParam(bag, "pageSize"), DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(Math.max(pageSizeRaw, 10), MAX_PAGE_SIZE);

  return {
    q,
    role,
    status,
    plan,
    page,
    pageSize,
  };
}

export function serializeAdminUsersQuery(query: AdminUsersQuery): URLSearchParams {
  const params = new URLSearchParams();
  const appendIf = (key: string, value: string | number | null) => {
    if (value === null || value === undefined || value === "") return;
    params.set(key, String(value));
  };

  if (query.q) appendIf("q", query.q);
  if (query.role !== "all") appendIf("role", query.role);
  if (query.status !== "all") appendIf("status", query.status);
  if (query.plan !== "all") appendIf("plan", query.plan);
  if (query.page > 1) appendIf("page", query.page);
  if (query.pageSize !== DEFAULT_PAGE_SIZE) appendIf("pageSize", query.pageSize);

  return params;
}

export function getAdminUserStatus(user: {
  role?: string | null;
  onboardingCompleted?: boolean | null;
  pendingCount?: number | null;
  profileMissing?: boolean;
}): AdminUserStatus {
  if (user.profileMissing) return "missing";
  if ((user.pendingCount ?? 0) > 0) return "pending";
  const normalizedRole = normalizeRole(user.role ?? null);
  const onboardingKnown = typeof user.onboardingCompleted === "boolean";
  const isComplete = onboardingKnown ? user.onboardingCompleted : !!normalizedRole;
  if (!isComplete) return "incomplete";
  return "active";
}

export function filterAdminUsers<T extends AdminUserRow>(
  users: T[],
  query: AdminUsersQuery
): T[] {
  const trimmedQuery = query.q?.trim().toLowerCase() || null;

  return users.filter((user) => {
    if (trimmedQuery) {
      const email = user.email?.toLowerCase() ?? "";
      const fullName = user.fullName?.toLowerCase() ?? "";
      const id = user.id.toLowerCase();
      const match =
        email.includes(trimmedQuery) ||
        fullName.includes(trimmedQuery) ||
        id.includes(trimmedQuery);
      if (!match) return false;
    }

    if (query.role !== "all") {
      const normalizedRole = normalizeRole(user.role ?? null);
      if (normalizedRole !== query.role) return false;
    }

    if (query.plan !== "all") {
      const normalizedPlan = normalizePlanTier(user.planTier ?? null);
      if (normalizedPlan !== query.plan) return false;
    }

    if (query.status !== "all") {
      if (getAdminUserStatus(user) !== query.status) return false;
    }

    return true;
  });
}

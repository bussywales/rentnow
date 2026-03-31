type AdminAuthUser = {
  id: string;
  email?: string | null;
};

type AdminAuthListResult = {
  data?: { users?: AdminAuthUser[] | null } | null;
  error?: { message?: string } | null;
};

type AdminAuthClient = {
  auth: {
    admin: {
      listUsers: (options: {
        page: number;
        perPage: number;
      }) => Promise<AdminAuthListResult>;
    };
  };
};

const LOOKUP_PAGE_SIZE = 200;
const LOOKUP_MAX_PAGES = 50;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function buildAdminBillingLookupHref({
  profileId,
  email,
}: {
  profileId: string;
  email?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("profileId", profileId);
  if (email?.trim()) {
    params.set("email", email.trim());
  }
  return `/admin/billing?${params.toString()}`;
}

export async function findAdminAuthUserByEmail(
  adminClient: AdminAuthClient,
  email: string
): Promise<AdminAuthUser | null> {
  const target = normalizeEmail(email);

  for (let page = 1; page <= LOOKUP_MAX_PAGES; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: LOOKUP_PAGE_SIZE,
    });
    if (error) {
      throw new Error(error.message || "Unable to load auth users.");
    }

    const users = data?.users ?? [];
    const matched = users.find((candidate) => normalizeEmail(candidate.email ?? "") === target);
    if (matched) {
      return matched;
    }

    if (users.length < LOOKUP_PAGE_SIZE) {
      return null;
    }
  }

  return null;
}

export async function findAdminAuthUserById(
  adminClient: AdminAuthClient,
  profileId: string
): Promise<AdminAuthUser | null> {
  for (let page = 1; page <= LOOKUP_MAX_PAGES; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage: LOOKUP_PAGE_SIZE,
    });
    if (error) {
      throw new Error(error.message || "Unable to load auth users.");
    }

    const users = data?.users ?? [];
    const matched = users.find((candidate) => candidate.id === profileId);
    if (matched) {
      return matched;
    }

    if (users.length < LOOKUP_PAGE_SIZE) {
      return null;
    }
  }

  return null;
}

export async function resolveAdminBillingLookupIdentity({
  adminClient,
  email,
  profileId,
}: {
  adminClient: AdminAuthClient;
  email?: string | null;
  profileId?: string | null;
}): Promise<
  | {
      ok: true;
      profileId: string;
      email: string | null;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const trimmedEmail = email?.trim() ?? "";
  const trimmedProfileId = profileId?.trim() ?? "";

  if (!trimmedEmail && !trimmedProfileId) {
    return { ok: false, error: "Provide an email or profile ID." };
  }

  let authUserFromEmail: AdminAuthUser | null = null;
  if (trimmedEmail) {
    authUserFromEmail = await findAdminAuthUserByEmail(adminClient, trimmedEmail);
    if (!authUserFromEmail) {
      return { ok: false, error: "User not found." };
    }
  }

  if (trimmedProfileId && authUserFromEmail && authUserFromEmail.id !== trimmedProfileId) {
    return {
      ok: false,
      error: "Email and profile ID refer to different accounts.",
    };
  }

  const resolvedProfileId = trimmedProfileId || authUserFromEmail?.id || "";
  if (!resolvedProfileId) {
    return { ok: false, error: "Provide an email or profile ID." };
  }

  const authUser =
    authUserFromEmail && authUserFromEmail.id === resolvedProfileId
      ? authUserFromEmail
      : await findAdminAuthUserById(adminClient, resolvedProfileId);

  return {
    ok: true,
    profileId: resolvedProfileId,
    email: authUser?.email ?? authUserFromEmail?.email ?? null,
  };
}

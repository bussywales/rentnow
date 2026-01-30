import DashboardMessagesClient from "@/components/messaging/DashboardMessagesClient";
import { ErrorState } from "@/components/ui/ErrorState";
import { DEV_MOCKS } from "@/lib/env";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { getUserRole } from "@/lib/authz";
import { listThreadsForUser, getThreadDetail } from "@/lib/messaging/threads";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

async function resolveSearchParams(raw?: SearchParams | Promise<SearchParams>) {
  if (raw && typeof (raw as { then?: unknown }).then === "function") {
    return (raw as Promise<SearchParams>);
  }
  return raw ?? {};
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const supabaseReady = hasServerSupabaseEnv();
  let currentUser: Profile | null = null;
  let threads: Awaited<ReturnType<typeof listThreadsForUser>>["threads"] = [];
  let initialThread: Awaited<ReturnType<typeof getThreadDetail>>["detail"] = null;
  let fetchError: string | null = null;

  if (supabaseReady) {
    try {
      const { supabase, user } = await getServerAuthUser();

      if (user) {
        currentUser = {
          id: user.id,
          role: "tenant",
          full_name: user.email || "You",
        };

        const role = await getUserRole(supabase, user.id);
        if (role) {
          currentUser.role = role;
        }

        const threadResult = await listThreadsForUser({
          client: supabase,
          userId: user.id,
          role,
        });
        threads = threadResult.threads;
        if (threadResult.error && !DEV_MOCKS) {
          fetchError = threadResult.error;
        }

        const params = await resolveSearchParams(searchParams);
        const threadIdRaw = params?.thread;
        const threadId = Array.isArray(threadIdRaw) ? threadIdRaw[0] : threadIdRaw;
        if (threadId) {
          const detailResult = await getThreadDetail({
            client: supabase,
            userId: user.id,
            role,
            threadId,
          });
          if (detailResult.detail) {
            const lastMessage = detailResult.detail.messages.at(-1) ?? null;
            initialThread = {
              thread: {
                ...detailResult.detail.thread,
                last_message: lastMessage?.body ?? null,
                last_message_at: lastMessage?.created_at ?? detailResult.detail.thread.last_post_at ?? null,
                unread_count: 0,
              },
              messages: detailResult.detail.messages,
            };
          }
        }
      }
    } catch {
      if (!DEV_MOCKS) {
        fetchError = "Unable to load messages right now.";
      }
    }
  } else if (!DEV_MOCKS) {
    fetchError = "Supabase is not configured; messaging is unavailable.";
  }

  if (fetchError && !DEV_MOCKS) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Messages unavailable"
          description={fetchError}
          retryHref="/tenant/messages"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Messages</h1>
        <p className="text-sm text-slate-600">
          Chat about availability, pricing, and viewings.
        </p>
      </div>
      <DashboardMessagesClient
        initialThreads={threads}
        initialThread={initialThread}
        currentUser={currentUser}
        role={currentUser?.role ?? null}
      />
    </div>
  );
}

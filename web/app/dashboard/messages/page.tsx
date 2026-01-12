import { MessageThread } from "@/components/messaging/MessageThread";
import { ErrorState } from "@/components/ui/ErrorState";
import { DEV_MOCKS } from "@/lib/env";
import { MESSAGING_RULES } from "@/lib/messaging/permissions";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { hasServerSupabaseEnv } from "@/lib/supabase/server";
import type { Message, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

const demoMessages: Message[] = [
  {
    id: "m1",
    property_id: "mock-1",
    sender_id: "tenant-1",
    recipient_id: "owner-1",
    body: "Hello! Is the apartment pet-friendly? I'd like to schedule a viewing.",
    created_at: new Date().toISOString(),
  },
];

export default async function MessagesPage() {
  const supabaseReady = hasServerSupabaseEnv();
  let currentUser: Profile | null = null;
  let messages: Message[] = DEV_MOCKS ? demoMessages : [];
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

        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .order("created_at", { ascending: true });

        if (!error && data) {
          messages = data as Message[];
        } else if (error && !DEV_MOCKS) {
          fetchError = "Unable to load messages right now.";
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

  const demoMode = DEV_MOCKS && (!supabaseReady || !currentUser);

  if (fetchError && !DEV_MOCKS) {
    return (
      <div className="space-y-4">
        <ErrorState
          title="Messages unavailable"
          description={fetchError}
          retryHref="/dashboard/messages"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Messages</h1>
        <p className="text-sm text-slate-600">
          Chat with tenants about availability, pricing, and viewings.
        </p>
        {demoMode && (
          <p className="mt-2 text-sm text-amber-700">
            Demo mode: connect Supabase and sign in to sync your real conversations.
          </p>
        )}
      </div>
      <MessageThread
        messages={messages}
        currentUser={currentUser}
        canSend={false}
        restriction={{
          message: "Messaging is read-only here. Open a listing to contact the host.",
          cta: { href: "/support", label: "Contact support" },
        }}
        rules={MESSAGING_RULES}
      />
    </div>
  );
}

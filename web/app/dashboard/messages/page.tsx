import { MessageThread } from "@/components/messaging/MessageThread";
import { ErrorState } from "@/components/ui/ErrorState";
import { createServerSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase/server";
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
  const allowDemo = process.env.NODE_ENV !== "production";
  let currentUser: Profile | null = null;
  let messages: Message[] = allowDemo ? demoMessages : [];
  let fetchError: string | null = null;

  if (supabaseReady) {
    try {
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
        } else if (error && !allowDemo) {
          fetchError = "Unable to load messages right now.";
        }
      }
    } catch (err) {
      if (!allowDemo) {
        fetchError = "Unable to load messages right now.";
      }
    }
  } else if (!allowDemo) {
    fetchError = "Supabase is not configured; messaging is unavailable.";
  }

  const demoMode = allowDemo && (!supabaseReady || !currentUser);

  if (fetchError && !allowDemo) {
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
      <MessageThread messages={messages} currentUser={currentUser} />
    </div>
  );
}

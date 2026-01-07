import { MessageThread } from "@/components/messaging/MessageThread";
import { ErrorState } from "@/components/ui/ErrorState";
import { getApiBaseUrl } from "@/lib/env";
import { mapDeliveryState } from "@/lib/messaging/status";
import type { Message } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

type SharePayload = {
  messages: Message[];
  expires_at: string;
};

export default async function ShareMessagesPage({ params }: Props) {
  const { token } = await params;
  const apiBaseUrl = await getApiBaseUrl();
  const apiUrl = `${apiBaseUrl}/api/messages/share/${token}`;
  let payload: SharePayload | null = null;

  try {
    const res = await fetch(apiUrl, { cache: "no-store" });
    if (!res.ok) {
      return (
        <ErrorState
          title="Share link unavailable"
          description="This link is invalid or has expired."
          retryHref="/support"
        />
      );
    }
    const data = await res.json();
    payload = {
      messages: mapDeliveryState((data?.messages as Message[]) || []),
      expires_at: data?.expires_at,
    };
  } catch {
    return (
      <ErrorState
        title="Share link unavailable"
        description="This link is invalid or has expired."
        retryHref="/support"
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Shared thread</h1>
        <p className="text-sm text-slate-600">Read-only link.</p>
        {payload?.expires_at && (
          <p className="text-xs text-slate-500">
            Expires {new Date(payload.expires_at).toLocaleString()}
          </p>
        )}
      </div>
      <MessageThread
        messages={payload?.messages || []}
        canSend={false}
        restriction={{
          message: "Read-only link. You cannot send messages from here.",
          cta: { href: "/support", label: "Contact support" },
        }}
      />
    </div>
  );
}

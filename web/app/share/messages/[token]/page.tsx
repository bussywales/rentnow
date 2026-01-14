import { redirect } from "next/navigation";
import { MessageThread } from "@/components/messaging/MessageThread";
import { ErrorState } from "@/components/ui/ErrorState";
import { getShareStatusCopy, type ShareLinkStatus } from "@/lib/messaging/share";
import { logShareAccess } from "@/lib/messaging/share-logging";
import { mapDeliveryState } from "@/lib/messaging/status";
import { getServerAuthUser } from "@/lib/auth/server-session";
import { logAuthRedirect } from "@/lib/auth/auth-redirect-log";
import type { Message } from "@/lib/types";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ token: string }>;
};

type SharePayload = {
  status: ShareLinkStatus;
  property_id: string;
  messages: Message[];
  expires_at: string;
  revoked_at?: string | null;
};

export default async function ShareMessagesPage({ params }: Props) {
  const { token } = await params;
  const sharePath = `/share/messages/${token}`;
  const { supabase, user } = await getServerAuthUser();

  if (!user) {
    logShareAccess({ result: "unauthenticated" });
    logAuthRedirect(sharePath);
    redirect(`/auth/login?reason=auth&next=${encodeURIComponent(sharePath)}`);
  }

  let payload: SharePayload | null = null;

  try {
    const { data, error } = await supabase.rpc("get_message_thread_share", {
      p_token: token,
    });
    if (error || !data) {
      logShareAccess({ result: "invalid", actorProfileId: user.id });
      const invalidCopy = getShareStatusCopy("invalid");
      return (
        <ErrorState
          title={invalidCopy.title}
          description={invalidCopy.description}
          retryHref={invalidCopy.cta?.href}
          retryLabel={invalidCopy.cta?.label}
        />
      );
    }
    const status = (data?.status as ShareLinkStatus)
      ?? (Array.isArray(data?.messages) ? "active" : "invalid");
    payload = {
      status,
      property_id: data?.property_id,
      messages: status === "active"
        ? mapDeliveryState((data?.messages as Message[]) || [])
        : [],
      expires_at: data?.expires_at,
      revoked_at: data?.revoked_at,
    };
    logShareAccess({
      result: status === "active" ? "ok" : status,
      actorProfileId: user.id,
      propertyId: data?.property_id ?? null,
    });
  } catch {
    logShareAccess({ result: "invalid", actorProfileId: user.id });
    const invalidCopy = getShareStatusCopy("invalid");
    return (
      <ErrorState
        title={invalidCopy.title}
        description={invalidCopy.description}
        retryHref={invalidCopy.cta?.href}
        retryLabel={invalidCopy.cta?.label}
      />
    );
  }

  if (!payload || payload.status !== "active") {
    const copy = getShareStatusCopy(payload?.status ?? "invalid");
    let description = copy.description;
    if (payload?.status === "expired" && payload.expires_at) {
      description = `${description} Expired ${new Date(payload.expires_at).toLocaleString()}.`;
    }
    if (payload?.status === "revoked" && payload.revoked_at) {
      description = `${description} Revoked ${new Date(payload.revoked_at).toLocaleString()}.`;
    }
    return (
      <ErrorState
        title={copy.title}
        description={description}
        retryHref={copy.cta?.href}
        retryLabel={copy.cta?.label}
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageThread } from "@/components/messaging/MessageThread";
import type { Message, Profile, UserRole } from "@/lib/types";
import type { MessageThreadPreview } from "@/lib/messaging/threads";
import type { MessagingPermission } from "@/lib/messaging/permissions";
import { mapDeliveryState, withDeliveryState } from "@/lib/messaging/status";

type ThreadDetail = {
  thread: MessageThreadPreview;
  messages: Message[];
  permission?: MessagingPermission | null;
};

type Props = {
  initialThreads: MessageThreadPreview[];
  initialThread?: ThreadDetail | null;
  currentUser: Profile | null;
  role: UserRole | null;
};

function formatTimestamp(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function DashboardMessagesClient({
  initialThreads,
  initialThread,
  currentUser,
  role,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadId = searchParams.get("thread");

  const [threads, setThreads] = useState<MessageThreadPreview[]>(initialThreads);
  const [activeThread, setActiveThread] = useState<ThreadDetail | null>(
    initialThread ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!threadId) {
      setActiveThread(null);
      return;
    }
    if (activeThread?.thread.id === threadId) return;

    const fetchThread = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/messages/thread/${threadId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Unable to load conversation.");
          setActiveThread(null);
          return;
        }
        const data = await res.json();
        const detail: ThreadDetail = {
          thread: data.thread,
          messages: mapDeliveryState(data.messages || []),
          permission: data.permission ?? null,
        };
        setActiveThread(detail);
        setError(null);

        fetch(`/api/messages/thread/${threadId}/read`, { method: "POST" }).catch(
          () => null
        );
        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === threadId ? { ...thread, unread_count: 0 } : thread
          )
        );
      } catch {
        setError("Unable to load conversation.");
      } finally {
        setLoading(false);
      }
    };

    fetchThread();
  }, [activeThread?.thread.id, threadId]);

  const filteredThreads = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return threads;
    return threads.filter((thread) => {
      const haystack = `${thread.title} ${thread.participant_name ?? ""}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [threads, search]);

  const handleSelect = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("thread", id);
    router.replace(`/dashboard/messages?${params.toString()}`, { scroll: false });
  };

  const handleSend = async (body: string) => {
    if (!activeThread) return false;
    setError(null);
    const res = await fetch(`/api/messages/thread/${activeThread.thread.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Unable to send message.");
      return false;
    }
    const data = await res.json();
    if (data?.message) {
      setActiveThread((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, withDeliveryState(data.message)],
            }
          : prev
      );
      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === activeThread.thread.id
            ? {
                ...thread,
                last_message: data.message.body,
                last_message_at: data.message.created_at ?? new Date().toISOString(),
                last_post_at: data.message.created_at ?? new Date().toISOString(),
              }
            : thread
        )
      );
    }
    return true;
  };

  const canSend =
    activeThread?.permission?.allowed === true &&
    (role === "tenant" || role === "landlord" || role === "agent");

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <label className="text-xs text-slate-600">Search</label>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search listing or participant"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm shadow-sm"
          />
        </div>
        <div className="space-y-2">
          {filteredThreads.length === 0 && (
            <p className="text-sm text-slate-500">No messages yet.</p>
          )}
          {filteredThreads.map((thread) => {
            const isActive = thread.id === threadId;
            return (
              <button
                key={thread.id}
                type="button"
                onClick={() => handleSelect(thread.id)}
                data-testid="message-thread-row"
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span className="truncate">{thread.title}</span>
                  {thread.unread_count > 0 && (
                    <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                      {thread.unread_count}
                    </span>
                  )}
                </div>
                <p className={`mt-1 line-clamp-2 text-xs ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                  {thread.last_message || "No messages yet."}
                </p>
                <div className={`mt-2 text-[11px] ${isActive ? "text-slate-200" : "text-slate-400"}`}>
                  {thread.participant_name || thread.participant_role || "Participant"} ·{" "}
                  {formatTimestamp(thread.last_message_at || thread.last_post_at)}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {!threadId && (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-slate-500">
            <p className="text-base font-semibold text-slate-800">Select a conversation</p>
            <p className="mt-1">Pick a thread from the left to read and reply.</p>
          </div>
        )}
        {threadId && (
          <>
            <div className="border-b border-slate-100 pb-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Conversation</div>
              <h2 className="text-xl font-semibold text-slate-900">
                {activeThread?.thread.title || "Loading..."}
              </h2>
              <p className="text-sm text-slate-600">
                {activeThread?.thread.participant_name ||
                  activeThread?.thread.participant_role ||
                  "Participant"}
              </p>
            </div>
            {error && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                {error}
              </div>
            )}
            <div className="mt-4">
              <MessageThread
                messages={activeThread?.messages ?? []}
                currentUser={currentUser}
                onSend={canSend ? handleSend : undefined}
                loading={loading}
                canSend={canSend}
                restriction={
                  !canSend && activeThread?.permission?.message
                    ? { message: activeThread.permission.message }
                    : null
                }
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

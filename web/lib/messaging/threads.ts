import type { SupabaseClient } from "@supabase/supabase-js";
import type { Message, Profile, UserRole } from "@/lib/types";
import { normalizeRole } from "@/lib/roles";

// Messaging schema note:
// - Legacy messages live in public.messages (one row per post).
// - Minimal threading adds public.message_threads and messages.thread_id for inbox replies.

export type MessageThreadRow = {
  id: string;
  property_id: string;
  tenant_id: string;
  host_id: string;
  subject: string | null;
  last_post_at: string | null;
  status: string | null;
};

export type MessageThreadPreview = MessageThreadRow & {
  title: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  last_read_at: string | null;
  participant_name: string | null;
  participant_role: UserRole | null;
};

export type MessageThreadDetail = {
  thread: MessageThreadPreview;
  messages: Message[];
};

type ThreadListInput = {
  client: SupabaseClient;
  userId: string;
  role: UserRole | null;
};

type ThreadDetailInput = ThreadListInput & { threadId: string };

export function computeUnreadCount(
  messages: Message[],
  userId: string,
  lastReadAt: string | null
) {
  if (!messages.length) return 0;
  const lastRead = lastReadAt ? new Date(lastReadAt).getTime() : null;
  return messages.reduce((count, message) => {
    if (message.sender_id === userId) return count;
    if (!message.created_at) return count;
    if (!lastRead) return count + 1;
    const createdAt = new Date(message.created_at).getTime();
    return createdAt > lastRead ? count + 1 : count;
  }, 0);
}

export function buildThreadParticipantFilter(role: UserRole | null, userId: string) {
  if (role === "admin") return null;
  return `tenant_id.eq.${userId},host_id.eq.${userId}`;
}

export async function listThreadsForUser({
  client,
  userId,
  role,
}: ThreadListInput): Promise<{ threads: MessageThreadPreview[]; error: string | null }> {
  let query = client
    .from("message_threads")
    .select("id, property_id, tenant_id, host_id, subject, last_post_at, status")
    .order("last_post_at", { ascending: false });

  const participantFilter = buildThreadParticipantFilter(role, userId);
  if (participantFilter) {
    query = query.or(participantFilter);
  }

  const { data: threads, error } = await query;
  if (error || !threads) {
    return { threads: [], error: error?.message ?? "Unable to load threads." };
  }

  const threadRows = threads as MessageThreadRow[];
  const threadIds = threadRows.map((row) => row.id);
  if (!threadIds.length) {
    return { threads: [], error: null };
  }

  const { data: readRows } = await client
    .from("message_thread_reads")
    .select("thread_id, last_read_at")
    .in("thread_id", threadIds)
    .eq("user_id", userId);

  const readMap = new Map<string, string | null>();
  (readRows as { thread_id: string; last_read_at: string | null }[] | null | undefined)?.forEach(
    (row) => readMap.set(row.thread_id, row.last_read_at)
  );

  const { data: posts } = await client
    .from("messages")
    .select("id, thread_id, sender_id, recipient_id, body, created_at, read_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false });

  const latestByThread = new Map<string, Message>();
  const unreadCounts = new Map<string, number>();
  (posts as Message[] | null | undefined)?.forEach((post) => {
    const threadId = (post as Message & { thread_id?: string }).thread_id || "";
    if (!latestByThread.has(threadId)) {
      latestByThread.set(threadId, post);
    }
    if (post.sender_id === userId) return;
    const lastReadAt = readMap.get(threadId) ?? null;
    const createdAt = post.created_at ? new Date(post.created_at).getTime() : 0;
    if (!lastReadAt) {
      unreadCounts.set(threadId, (unreadCounts.get(threadId) ?? 0) + 1);
      return;
    }
    const lastRead = new Date(lastReadAt).getTime();
    if (createdAt > lastRead) {
      unreadCounts.set(threadId, (unreadCounts.get(threadId) ?? 0) + 1);
    }
  });

  const propertyIds = Array.from(new Set(threadRows.map((row) => row.property_id)));
  let titles: Record<string, string> = {};
  if (propertyIds.length) {
    const { data: properties } = await client
      .from("properties")
      .select("id, title")
      .in("id", propertyIds);
    titles = Object.fromEntries((properties as { id: string; title: string | null }[] | null | undefined)?.map((p) => [p.id, p.title || "Listing"]) ?? []);
  }

  const participantIds = new Set<string>();
  threadRows.forEach((thread) => {
    const otherId = role === "tenant" ? thread.host_id : thread.tenant_id;
    if (otherId) participantIds.add(otherId);
  });
  let participants: Record<string, Profile> = {};
  if (participantIds.size) {
    const { data: profiles } = await client
      .from("profiles")
      .select("id, full_name, role")
      .in("id", Array.from(participantIds));
    participants = Object.fromEntries(
      (profiles as Profile[] | null | undefined)?.map((p) => [p.id, p]) ?? []
    );
  }

  const previews: MessageThreadPreview[] = threadRows.map((thread) => {
    const latest = latestByThread.get(thread.id) || null;
    const participantId = role === "tenant" ? thread.host_id : thread.tenant_id;
    const participant = participantId ? participants[participantId] : null;
    const title = thread.subject || titles[thread.property_id] || "Listing";
    return {
      ...thread,
      title,
      last_message: latest?.body ?? null,
      last_message_at: latest?.created_at ?? thread.last_post_at ?? null,
      unread_count: unreadCounts.get(thread.id) ?? 0,
      last_read_at: readMap.get(thread.id) ?? null,
      participant_name: participant?.full_name ?? null,
      participant_role: normalizeRole(participant?.role ?? null),
    };
  });

  return { threads: previews, error: null };
}

export async function getThreadDetail({
  client,
  userId,
  role,
  threadId,
}: ThreadDetailInput): Promise<{ detail: MessageThreadDetail | null; error: string | null }> {
  const { data: thread, error } = await client
    .from("message_threads")
    .select("id, property_id, tenant_id, host_id, subject, last_post_at, status")
    .eq("id", threadId)
    .maybeSingle();

  if (error || !thread) {
    return { detail: null, error: error?.message ?? "Thread not found." };
  }

  const threadRow = thread as MessageThreadRow;
  if (role !== "admin" && userId !== threadRow.tenant_id && userId !== threadRow.host_id) {
    return { detail: null, error: "Forbidden" };
  }

  const { data: posts } = await client
    .from("messages")
    .select("id, thread_id, property_id, sender_id, recipient_id, body, created_at, sender_role, read_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  const { data: property } = await client
    .from("properties")
    .select("id, title")
    .eq("id", threadRow.property_id)
    .maybeSingle();
  const title = threadRow.subject || property?.title || "Listing";

  const participantId = role === "tenant" ? threadRow.host_id : threadRow.tenant_id;
  let participantName: string | null = null;
  let participantRole: UserRole | null = null;
  if (participantId) {
    const { data: profile } = await client
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", participantId)
      .maybeSingle();
    participantName = profile?.full_name ?? null;
    participantRole = normalizeRole(profile?.role ?? null);
  }

  const messageList = (posts as Message[] | null | undefined) ?? [];
  const lastMessage = messageList.at(-1) ?? null;
  const { data: readRow } = await client
    .from("message_thread_reads")
    .select("last_read_at")
    .eq("thread_id", threadId)
    .eq("user_id", userId)
    .maybeSingle();
  const lastReadAt = (readRow as { last_read_at?: string | null } | null | undefined)?.last_read_at ?? null;

  return {
    detail: {
      thread: {
        ...threadRow,
        title,
        last_message: lastMessage?.body ?? null,
        last_message_at: lastMessage?.created_at ?? threadRow.last_post_at ?? null,
        unread_count: computeUnreadCount(messageList, userId, lastReadAt),
        last_read_at: lastReadAt,
        participant_name: participantName,
        participant_role: participantRole,
      },
      messages: messageList,
    },
    error: null,
  };
}

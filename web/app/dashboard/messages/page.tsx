import { MessageThread } from "@/components/messaging/MessageThread";
import type { Message, Profile } from "@/lib/types";

const messages: Message[] = [
  {
    id: "m1",
    property_id: "mock-1",
    sender_id: "tenant-1",
    recipient_id: "owner-1",
    body: "Hello! Is the apartment pet-friendly? I'd like to schedule a viewing.",
    created_at: new Date().toISOString(),
  },
];

const currentUser: Profile = {
  id: "owner-1",
  role: "landlord",
  full_name: "Demo Landlord",
};

export default function MessagesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Messages</h1>
        <p className="text-sm text-slate-600">
          Chat with tenants about availability, pricing, and viewings.
        </p>
      </div>
      <MessageThread messages={messages} currentUser={currentUser} />
    </div>
  );
}

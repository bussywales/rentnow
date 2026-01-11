import type { Message, MessageDeliveryState } from "@/lib/types";

export function deriveDeliveryState(message: {
  delivery_state?: MessageDeliveryState | string | null;
}): MessageDeliveryState {
  const state = message.delivery_state;
  if (state === "sent" || state === "delivered" || state === "read") {
    return state;
  }
  return "delivered";
}

export function withDeliveryState(
  message: Message,
  deliveryState: MessageDeliveryState = "delivered"
): Message {
  return { ...message, delivery_state: deliveryState };
}

export function mapDeliveryState(messages: Message[]): Message[] {
  return messages.map((message) => withDeliveryState(message));
}

export function formatDeliveryState(state: MessageDeliveryState): string {
  switch (state) {
    case "sent":
      return "Sent";
    case "read":
      return "Seen";
    default:
      return "Delivered";
  }
}

import type { Message } from "@langchain/langgraph-sdk";
import { format, isToday, isYesterday } from "date-fns";

/**
 * Extracts a string summary from a message's content, supporting multimodal (text, image, file, etc.).
 * - If text is present, returns the joined text.
 * - If not, returns a label for the first non-text modality (e.g., 'Image', 'Other').
 * - If unknown, returns 'Multimodal message'.
 */
export function getContentString(content: Message["content"]): string {
  if (typeof content === "string") return content;
  const texts = content
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text);
  return texts.join(" ");
}

/**
 * Formats a timestamp for display in chat messages.
 * - Shows time only if today (e.g., "2:30 PM")
 * - Shows "Yesterday" + time if yesterday (e.g., "Yesterday 2:30 PM")
 * - Shows date + time if older (e.g., "Jan 15, 2:30 PM")
 */
export function formatMessageTimestamp(timestamp: Date | string | number): string {
  const date = typeof timestamp === "string" || typeof timestamp === "number"
    ? new Date(timestamp)
    : timestamp;

  if (isToday(date)) {
    return format(date, "h:mm a");
  } else if (isYesterday(date)) {
    return `Yesterday ${format(date, "h:mm a")}`;
  } else {
    return format(date, "MMM d, h:mm a");
  }
}

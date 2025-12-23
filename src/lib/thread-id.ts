/**
 * Generate a deterministic UUID from a listing_id.
 * 
 * Uses UUID5 (SHA-1 based) with a fixed namespace to ensure the same
 * listing_id always produces the same UUID, allowing thread persistence.
 * 
 * This ensures that:
 * - Same listing_id → Same threadId → Same conversation thread
 * - ThreadId is a valid UUID format required by LangGraph
 * - Mapping is deterministic and consistent across sessions
 */
import { v5 as uuidv5 } from "uuid";

// DNS namespace UUID (standard UUID for DNS namespace)
// This should match the namespace used in the backend Python code
const DNS_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

/**
 * Maps a listing_id to a deterministic threadId (UUID)
 * 
 * @param listingId - The listing ID string
 * @returns A deterministic UUID string, or undefined if listingId is invalid
 */
export function listingIdToThreadId(
  listingId: string | null | undefined,
): string | undefined {
  if (!listingId || typeof listingId !== "string" || listingId.trim() === "") {
    return undefined;
  }

  // Use a consistent prefix to namespace listing IDs
  // This ensures listing IDs don't collide with other types of IDs
  const name = `listing:${listingId.trim()}`;

  // Generate deterministic UUID5
  return uuidv5(name, DNS_NAMESPACE);
}


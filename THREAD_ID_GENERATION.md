# Thread ID Generation from Listing ID

## Overview

The frontend now automatically generates a deterministic `threadId` from `listingId` using UUID5. This ensures that the same `listingId` always produces the same `threadId`, allowing conversation threads to persist across sessions.

## How It Works

### Automatic Generation

When you provide `listingId` in the URL (without `threadId`), the frontend will:

1. **Generate a deterministic UUID** from the `listingId` using UUID5
2. **Add the generated `threadId` to the URL** automatically
3. **Use that `threadId`** for the conversation thread

### URL Format

**Before (manual threadId):**
```
http://localhost:3000/?threadId=e2adf431-b550-49dd-b984-98d32203e557&listingId=123&user_name=Yu
```

**Now (automatic threadId):**
```
http://localhost:3000/?listingId=123&user_name=Yu
```

The `threadId` will be automatically generated and added to the URL:
```
http://localhost:3000/?threadId=<generated-uuid>&listingId=123&user_name=Yu
```

## Implementation Details

### UUID5 Generation

The `threadId` is generated using UUID5 (SHA-1 based) with a DNS namespace:

```typescript
import { listingIdToThreadId } from "@/lib/thread-id";

const threadId = listingIdToThreadId("123"); 
// Always returns the same UUID for the same listingId
```

### Deterministic Mapping

- **Same `listingId`** → **Same `threadId`** → **Same conversation thread**
- Uses namespace prefix: `listing:{listingId}`
- DNS namespace UUID: `6ba7b810-9dad-11d1-80b4-00c04fd430c8`

### Behavior

1. **If `listingId` is provided but `threadId` is not:**
   - ✅ Generates `threadId` automatically
   - ✅ Updates URL with generated `threadId`
   - ✅ Uses generated `threadId` for conversation

2. **If `threadId` is manually provided:**
   - ✅ Uses the provided `threadId` (no override)
   - ✅ Allows manual override when needed

3. **If `listingId` changes but `threadId` is already set:**
   - ✅ Keeps existing `threadId` (doesn't regenerate)
   - ✅ Allows conversation continuity

## Example Usage

### Basic Usage

```typescript
// URL: /?listingId=1731402834534x223925604309008400&user_name=Yu

// Frontend automatically:
// 1. Generates threadId from listingId
// 2. Updates URL to include threadId
// 3. Uses threadId for conversation thread
```

### Manual Override

If you need to override the generated `threadId`:

```typescript
// URL: /?threadId=custom-thread-id&listingId=123&user_name=Yu

// Frontend will:
// 1. Use the provided threadId (no generation)
// 2. Ignore listingId for threadId generation
```

## Backend Compatibility

The frontend uses the same UUID5 generation logic as your backend:

- **Namespace**: DNS namespace UUID (`6ba7b810-9dad-11d1-80b4-00c04fd430c8`)
- **Format**: `listing:{listingId}`
- **Result**: Same `threadId` for same `listingId` on both frontend and backend

This ensures consistency between frontend and backend thread management.

## Files Modified

1. **`src/lib/thread-id.ts`** (new file)
   - Contains `listingIdToThreadId()` function
   - Uses UUID5 with DNS namespace

2. **`src/providers/Stream.tsx`**
   - Added automatic `threadId` generation
   - Updates URL when `threadId` is generated

## Testing

Test the following scenarios:

1. ✅ **Auto-generation**: `/?listingId=123&user_name=Yu` → Should generate and add `threadId`
2. ✅ **Manual override**: `/?threadId=custom&listingId=123` → Should use custom `threadId`
3. ✅ **Persistence**: Same `listingId` → Same `threadId` → Same thread
4. ✅ **URL update**: Generated `threadId` appears in URL

## Notes

- The generated `threadId` is a valid UUID format required by LangGraph
- The mapping is deterministic and consistent across sessions
- If you need a new thread for the same `listingId`, manually provide a different `threadId` or remove it from the URL


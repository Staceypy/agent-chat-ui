# Implementation Plan: Custom URL Parameters & Thread Management

## Overview
This document outlines the implementation plan for adding `threadId`, `listingId`, and `userName` URL parameters, with logic to create/resume threads and pass custom state to the agent.

## Requirements
1. Accept URL parameters: `threadId`, `listingId`, `userName`
2. If `threadId` doesn't exist in LangSmith → create new thread with initial state
3. If `threadId` exists → resume it
4. Pass `listingId` and `userName` to agent state

## Architecture Analysis

### Current Flow
1. **URL State Management**: Uses `nuqs` library for URL query parameters
2. **Thread Management**: `useStream` hook from `@langchain/langgraph-sdk/react` handles:
   - Auto-creates thread when `threadId` is null
   - Fetches thread when `threadId` is provided
3. **State Passing**: Custom state passed via `context` parameter in `stream.submit()`

### Key Files
- `src/providers/Stream.tsx` - Handles stream connection and thread management
- `src/providers/Thread.tsx` - Thread search/listing functionality
- `src/components/thread/index.tsx` - Main thread component, handles message submission
- `src/providers/client.ts` - LangGraph SDK client creation

## Implementation Steps

### Step 1: Add URL Query Parameters
**File**: `src/providers/Stream.tsx`, `src/components/thread/index.tsx`

Add `listingId` and `userName` using `nuqs`:
```typescript
const [listingId] = useQueryState("listingId");
const [userName] = useQueryState("userName");
```

### Step 2: Thread Existence Check
**File**: `src/providers/Stream.tsx`

Create utility function to check if thread exists:
```typescript
async function checkThreadExists(
  apiUrl: string,
  apiKey: string | null,
  threadId: string
): Promise<boolean> {
  try {
    const client = createClient(apiUrl, apiKey ?? undefined);
    await client.threads.get(threadId);
    return true;
  } catch (error) {
    return false;
  }
}
```

### Step 3: Handle Thread Creation with Initial State
**File**: `src/providers/Stream.tsx`

Modify `StreamSession` to:
- Check if thread exists when `threadId` is provided
- If doesn't exist, create it with initial state containing `listingId` and `userName`
- Use `configurable` parameter in `useStream` or pass via first `submit()` call

### Step 4: Pass Custom State to Agent
**File**: `src/components/thread/index.tsx`

Modify `handleSubmit` to include `listingId` and `userName` in context:
```typescript
const context = {
  ...(Object.keys(artifactContext).length > 0 ? artifactContext : {}),
  listingId: listingId ?? undefined,
  userName: userName ?? undefined,
};
```

### Step 5: Initial Thread Setup
**File**: `src/providers/Stream.tsx`

When thread doesn't exist but `threadId` is provided:
- Create thread with initial state via first submit with empty message or initialization
- Or use LangGraph SDK's thread creation API with configurable values

## Difficulty Assessment

### Complexity: **Medium** (3/5)

**Easy Parts:**
- ✅ URL parameter handling (already using `nuqs`)
- ✅ Passing context to agent (already implemented pattern)
- ✅ Reading URL parameters

**Medium Parts:**
- ⚠️ Thread existence check (requires API call)
- ⚠️ Thread creation with initial state (depends on LangGraph SDK capabilities)
- ⚠️ Handling edge cases (thread creation failures, etc.)

**Challenges:**
- 🔴 LangGraph SDK's `useStream` hook may not directly support creating threads with initial configurable state
- 🔴 May need to use LangGraph Client API directly for thread creation
- 🔴 Need to coordinate between URL params, thread creation, and state initialization

## Backend Agent Requirements

Your agent backend needs to:
1. Accept `listingId` and `userName` in the state/context
2. Store them in the graph state (likely in a `configurable` field or custom state field)
3. Use them throughout the conversation

Example agent state structure:
```python
# In your agent state
{
    "messages": [...],
    "listing_id": "1243535d9102",  # from context
    "user_name": "Ana",  # from context
    # ... other state
}
```

## Testing Checklist
- [ ] URL with existing threadId → resumes thread
- [ ] URL with non-existent threadId → creates new thread
- [ ] URL with listingId and userName → passes to agent
- [ ] URL without threadId → creates new thread normally
- [ ] Thread creation with initial state works correctly
- [ ] Context persists across messages


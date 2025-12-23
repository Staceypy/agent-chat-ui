# Customization Guide: URL Parameters & Thread Management

## Implementation Summary

This implementation adds support for `threadId`, `listingId`, and `user_name` URL parameters with automatic thread creation/resumption logic.

## How It Works

### URL Parameters
The frontend now accepts these URL query parameters:
- `threadId` - The thread ID to resume or create
- `listingId` - Custom parameter passed to agent state
- `user_name` - Custom parameter passed to agent state
- `chatHistoryOpen` - Controls chat history sidebar (existing)

**Example URL:**
```
http://localhost:3000/?chatHistoryOpen=true&threadId=e2adf431-b550-49dd-b984-98d32203e557&listingId=1243535d9102&user_name=Ana
```

### Thread Management Logic

1. **Thread Exists**: If `threadId` is provided and exists in LangSmith:
   - ✅ Resumes the existing thread
   - ✅ Loads conversation history
   - ✅ `listingId` and `user_name` are still passed in context for each message

2. **Thread Doesn't Exist**: If `threadId` is provided but doesn't exist:
   - ✅ Thread is created on first message submission
   - ✅ `listingId` and `user_name` are passed in the context
   - ⚠️ **Note**: The LangGraph SDK may create a new thread with a different ID if the provided one doesn't exist. To guarantee the exact `threadId`, create the thread on your backend first.

3. **No ThreadId**: If `threadId` is not provided:
   - ✅ New thread is created automatically on first message
   - ✅ `listingId` and `user_name` are passed in context

### Passing Data to Agent

The `listingId` and `user_name` are passed to your agent via the `context` parameter in each message submission:

```typescript
stream.submit(
  { 
    messages: [...],
    context: {
      listingId: "1243535d9102",
      user_name: "Ana",
      // ... other artifact context
    }
  },
  { /* options */ }
);
```

## Backend Agent Requirements

Your LangGraph agent needs to:

1. **Accept context in state**: The agent should accept `listingId` and `user_name` from the context/state
2. **Store in state**: Store these values in your graph state so they persist across messages
3. **Use throughout conversation**: Access these values as needed in your agent logic

### Example Agent State Structure

```python
# In your LangGraph agent state
from typing import TypedDict, Annotated
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    listing_id: str | None  # from context
    user_name: str | None   # from context (user_name)
    # ... other state fields
```

### Example: Reading Context in Agent

```python
def your_node(state: AgentState, config: RunnableConfig):
    # Access context from config
    context = config.get("configurable", {})
    listing_id = context.get("listingId")
    user_name = context.get("user_name")
    
    # Or store in state on first message
    if not state.get("listing_id") and listing_id:
        state["listing_id"] = listing_id
        state["user_name"] = user_name
    
    # Use in your logic
    # ...
    
    return state
```

## Files Modified

1. **`src/providers/Stream.tsx`**:
   - Added `checkThreadExists()` function
   - Added URL parameter reading for `listingId` and `user_name`
   - Added thread existence checking logic
   - Extended context type to include custom parameters

2. **`src/components/thread/index.tsx`**:
   - Modified `handleSubmit()` to include `listingId` and `user_name` in context
   - Reads custom parameters from stream context

## Testing

Test the following scenarios:

1. ✅ **Existing Thread**: `?threadId=existing-id` → Should resume thread
2. ✅ **New Thread with ID**: `?threadId=new-id&listingId=123&user_name=Ana` → Should create thread with context
3. ✅ **New Thread without ID**: `?listingId=123&user_name=Ana` → Should create new thread with context
4. ✅ **Context Persistence**: Verify `listingId` and `user_name` are passed in all message submissions

## Important Notes

1. **Thread ID Guarantee**: If you need to guarantee a specific `threadId`, create the thread on your backend first using the LangGraph Client API before redirecting to the frontend.

2. **Context Format**: The context is passed as a flat object. Your agent should read from `config.configurable` or handle it in your state initialization.

3. **Error Handling**: If thread checking fails, the system will still attempt to use the threadId. Errors are logged to console.

## Troubleshooting

**Issue**: ThreadId provided but thread not found
- **Solution**: The thread will be created on first message. If you need the exact ID, create it on backend first.

**Issue**: `listingId`/`user_name` not reaching agent
- **Solution**: Check your agent code reads from `config.configurable` or state initialization properly.

**Issue**: Thread creation fails
- **Solution**: Check API URL, API key, and network connectivity. Verify your LangGraph server is running.


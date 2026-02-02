Found several places with special handling based on message sequences. Summary:

## Places with special message sequence handling


### 2. **Last Message Type → Loading State Management**
**Location:** `src/components/thread/index.tsx:132-150`

```typescript
const lastMessage = messages[messages.length - 1];
if (lastMessage.type === "ai") {
  setFirstTokenReceived(true);
} else if (lastMessage.type === "tool") {
  // When a tool message appears, reset firstTokenReceived so typing indicator stays visible
  // until the AI message arrives
  setFirstTokenReceived(false);
}
```

**Special handling:**
- Assumes: `tool` → `ai` sequence
- If last message is `tool`, keeps loading indicator until `ai` arrives
- If two `ai` messages in a row, the second one immediately sets `firstTokenReceived = true` (may hide loading too early)

---

### 3. **Waiting for AI After Tool Message**
**Location:** `src/components/thread/index.tsx:152-158`

```typescript
const isWaitingForAI = useMemo(() => {
  if (!messages.length) return false;
  const lastMessage = messages[messages.length - 1];
  // If last message is a tool message, we're waiting for AI response
  return lastMessage.type === "tool";
}, [messages]);
```

**Special handling:**
- Assumes: `ai` → `tool` → `ai` sequence
- Shows loading indicator when last message is `tool`
- Issue: If two `ai` messages appear consecutively (missing user message), this won't detect it

---

### 4. **Tool Call Response Validation**
**Location:** `src/lib/ensure-tool-responses.ts:6-34`

```typescript
messages.forEach((message, index) => {
  if (message.type !== "ai" || message.tool_calls?.length === 0) {
    return;
  }
  // If it has tool calls, ensure the message which follows this is a tool message
  const followingMessage = messages[index + 1];
  if (followingMessage && followingMessage.type === "tool") {
    // Following message is a tool message, so we can ignore.
    return;
  }
  // Since the following message is not a tool message, we must create a new tool message
  newMessages.push(...);
});
```

**Special handling:**
- Assumes: `ai` (with tool_calls) → `tool` sequence
- Creates placeholder tool messages if missing
- Issue: If sequence is `ai` → `human` → `ai`, it will create tool messages incorrectly

---

### 5. **Message Filtering (Tool Messages Hidden)**
**Location:** `src/components/thread/index.tsx:349-353`

```typescript
const filtered = messages.filter(
  (m) =>
    !m.id?.startsWith(DO_NOT_RENDER_ID_PREFIX) &&
    m.type !== "tool",
);
```

**Special handling:**
- Tool messages are filtered out from display
- Assumes tool messages are intermediate and shouldn't be shown
- This means the UI only shows `human` and `ai` messages, so consecutive `ai` messages would appear back-to-back

---

### 6. **Q&A Pairs Detection (Backwards Iteration)**
**Location:** `src/components/thread/index.tsx:246-267`

```typescript
for (let i = messages.length - 1; i >= 0; i--) {
  const message = messages[i];
  if (message.type !== "ai") continue;
  // Parse Q&A pairs from AI message content
}
```

**Special handling:**
- Iterates backwards to find the most recent Q&A message
- Assumes Q&A pairs come from `ai` messages
- If two `ai` messages in a row, it will use the last one

---

### 7. **Is Last Message Check**
**Location:** `src/components/thread/messages/ai.tsx:88-89`

```typescript
const isLastMessage =
  thread.messages[thread.messages.length - 1].id === message?.id;
```

**Special handling:**
- Used to determine if interrupt should show on this message
- If two `ai` messages in a row, only the last one gets `isLastMessage = true`

---

## Issues with consecutive AI messages (missing user message)

If you have: `human` → `ai` → `ai` (missing user message):

1. No detection: There's no code that detects "two AI messages in a row"
2. Both AI messages render normally (lines 367-382 in `index.tsx`)
3. Loading state may be incorrect: `firstTokenReceived` gets set on the first `ai`, so loading might disappear prematurely
4. Interrupt display: Only the last `ai` message can show interrupts (due to `isLastMessage` check)
5. Q&A detection: Only the last `ai` message is checked for Q&A pairs

## Recommendations

Add detection for consecutive AI messages:

```typescript
// In index.tsx, before rendering messages
const hasConsecutiveAIMessages = useMemo(() => {
  for (let i = 1; i < filtered.length; i++) {
    const prev = filtered[i - 1];
    const curr = filtered[i];
    if (prev.type === "ai" && curr.type === "ai") {
      return true;
    }
  }
  return false;
}, [filtered]);
```

Then add special handling:
- Show a visual indicator between consecutive AI messages
- Adjust loading state logic
- Handle interrupts appropriately
- Consider if this indicates a missing user message or a valid agent-to-agent flow

Should I implement detection and handling for consecutive AI messages?
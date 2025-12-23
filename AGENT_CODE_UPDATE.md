# Agent Code Update: Reading listingId from Context

## Yes, you need to update your code!

The frontend passes `listingId` and `user_name` in the `context` parameter, which LangGraph makes available as `config.configurable` (not `config.metadata`).

## Updated Code

Here's your updated `extract_listing` function:

```python
async def extract_listing(config: RunnableConfig, state: AgentState, only_id: bool = False) -> Optional[Listing]:
    """
    Extract listing_id from config configurable (context) and fetch full listing details from Bubble.
    """
    listing_id = None
    
    # First, try to get from config.configurable (where context is passed)
    configurable = config.get("configurable", {}) if hasattr(config, "get") else {}
    if not configurable and hasattr(config, "configurable"):
        configurable = getattr(config, "configurable", {})
    
    # Try camelCase first (from frontend)
    listing_id = configurable.get("listingId") if isinstance(configurable, dict) else None
    
    # Fallback to snake_case for backward compatibility
    if not listing_id:
        listing_id = configurable.get("listing_id") if isinstance(configurable, dict) else None
    
    # Fallback to state if not in config
    if not listing_id:
        listing_id = state.get("listing", {}).get("listing_id") if isinstance(state.get("listing"), dict) else None
    
    # Also check if it's stored directly in state (for persistence)
    if not listing_id:
        listing_id = state.get("listing_id")
    
    if listing_id and isinstance(listing_id, str) and listing_id.strip():
        if only_id:
            return listing_id.strip()
        fetched = await fetch_listing(listing_id.strip())
        if fetched:
            return fetched
        return {"listing_id": listing_id.strip()}
    
    return None
```

## Key Changes

1. **Changed `config.metadata` → `config.configurable`**: The context parameter from the frontend is passed as `config.configurable` in LangGraph
2. **Added camelCase support**: Check for `listingId` (camelCase) first, then fallback to `listing_id` (snake_case)
3. **Added state fallback**: Also check `state.get("listing_id")` directly

## Store in State for Persistence

To persist `listingId` and `user_name` across messages, add this to your state initialization or an early node:

```python
def initialize_state(config: RunnableConfig, state: AgentState) -> AgentState:
    """Initialize state with listingId and user_name from context."""
    configurable = config.get("configurable", {}) if hasattr(config, "get") else {}
    
    # Store listingId if not already in state
    if not state.get("listing_id") and configurable.get("listingId"):
        state["listing_id"] = configurable["listingId"]
    
    # Store user_name if not already in state
    if not state.get("user_name") and configurable.get("user_name"):
        state["user_name"] = configurable["user_name"]
    
    return state
```

## Alternative: Update extract_listing to Store in State

You can also update `extract_listing` to store the value in state when first accessed:

```python
async def extract_listing(config: RunnableConfig, state: AgentState, only_id: bool = False) -> Optional[Listing]:
    """
    Extract listing_id from config configurable (context) and fetch full listing details from Bubble.
    Stores listing_id in state for persistence.
    """
    listing_id = None
    
    # First, try to get from config.configurable (where context is passed)
    configurable = config.get("configurable", {}) if hasattr(config, "get") else {}
    if not configurable and hasattr(config, "configurable"):
        configurable = getattr(config, "configurable", {})
    
    # Try camelCase first (from frontend)
    listing_id = configurable.get("listingId") if isinstance(configurable, dict) else None
    
    # Fallback to snake_case for backward compatibility
    if not listing_id:
        listing_id = configurable.get("listing_id") if isinstance(configurable, dict) else None
    
    # Fallback to state if not in config
    if not listing_id:
        listing_id = state.get("listing", {}).get("listing_id") if isinstance(state.get("listing"), dict) else None
    
    # Also check if it's stored directly in state (for persistence)
    if not listing_id:
        listing_id = state.get("listing_id")
    
    # Store in state if we found it in config but not in state
    if listing_id and not state.get("listing_id"):
        state["listing_id"] = listing_id
    
    if listing_id and isinstance(listing_id, str) and listing_id.strip():
        if only_id:
            return listing_id.strip()
        fetched = await fetch_listing(listing_id.strip())
        if fetched:
            return fetched
        return {"listing_id": listing_id.strip()}
    
    return None
```

## Summary

**Main change**: Use `config.configurable` instead of `config.metadata` to access the context values passed from the frontend.


---
name: integrations
description: View connected platforms, sync status, and diagnose connection errors. Use when user asks about integrations, data sources, what's syncing, or connection health.
---

# Integrations Skill

View connected platforms, sync status, and diagnose connection errors.

## When to Use
- "What integrations do I have?"
- "What platforms are connected?"
- "What data sources do we have?"
- "What's syncing to Precision?"
- "Is my HubSpot connected?"
- "Why is Stripe erroring?"
- "Show me my connections"

## Tools
- `list_data_source_connections` — Returns all connected and errored data sources

## Output Format

**ALWAYS format results as a table:**

| Integration | Status | Metrics | Last Sync | Health |
|-------------|--------|---------|-----------|--------|
| HubSpot     | ✅ connected | 12 | 2 hrs ago | Healthy |
| Stripe      | ⚠️ sync_error | 5 | 3 days ago | Error: API rate limit |
| QuickBooks  | ✅ connected | 8 | 1 hr ago | Healthy |

**Status icons:**
- ✅ = healthy (connected, syncing_to_warehouse, syncing_to_precision)
- ⚠️ = error (failed, sync_error, auth_error, connection_error)

**Include error messages** when `has_error` is true.

## Response Guidelines
- Lead with the table
- Highlight any errors prominently
- Suggest fixes for common errors (re-auth, check API limits, etc.)
- Mention if first sync is still pending

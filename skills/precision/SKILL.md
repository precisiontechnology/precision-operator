---
name: precision
description: Query Precision business metrics, diagnose bottlenecks, trace causality, retrieve playbooks, and manage integrations. Use when user asks about MRR, churn, revenue, goals, metrics, integrations, connected platforms, or "why" something changed.
---

# Precision Operator Skill

## CRITICAL: Always Search First

NEVER say "no metric found" or ask clarifying questions before searching.

When user asks about ANY metric:
1. FIRST call get_metrics_summary with their query
2. ONLY if results are empty, then ask for clarification
3. Never assume a metric doesn't exist

---

## Integrations / Data Sources

When user asks about integrations, connected platforms, or data sources:
- "What integrations do I have?"
- "What platforms are connected?"
- "What's syncing?"
- "Is HubSpot working?"

**Use:** `list_data_source_connections`

---

## Metrics by Integration

When user asks what metrics they're tracking from a specific integration:
- "What metrics am I tracking from HighLevel?"
- "Show me my Stripe metrics"
- "What am I pulling from HubSpot?"

**Workflow:**
1. Get connection ID → `list_data_source_connections`
2. List tracked metrics → `list_metrics_by_connection(connection_id)`

**Format as table:**

| Metric | Team | Current Value | Last Synced | Filters |
|--------|------|---------------|-------------|---------|
| MRR | Revenue | $45,230 | 2 hrs ago | — |
| Active Subscribers | Revenue | 142 | 2 hrs ago | product: Growth Accelerator |

**Contrast with `list_managed_queries`:**
- `list_metrics_by_connection` → What you ARE tracking (active metrics)
- `list_managed_queries` → What you COULD track (available templates)

**ALWAYS format as a table:**

| Integration | Status | Metrics | Last Sync | Health |
|-------------|--------|---------|-----------|--------|
| HubSpot     | ✅ connected | 12 | 2 hrs ago | Healthy |
| Stripe      | ⚠️ sync_error | 5 | 3 days ago | Error: API rate limit |
| QuickBooks  | ✅ connected | 8 | 1 hr ago | Healthy |

**Status icons:**
- ✅ = healthy (connected, syncing_to_warehouse, syncing_to_precision)
- ⏳ = syncing (first sync in progress)
- ⚠️ = error (failed, sync_error, auth_error, connection_error)

Include error messages when `has_error` is true.

---

## Metric Queries

**Workflow:**
1. User asks about any metric → `get_metrics_summary` FIRST
2. Need time-series trend → `get_metric_data(metric_id, days)`
3. "Why did X change?" → `explore_causality(metric_id, "upstream")`
4. "Show me the records" → `get_underlying_data(metric_id, date)`
5. "How do I fix this?" → `retrieve_kb_context`

---

## Metric Setup (Zero-Config)

When user wants to create/configure metrics from their integrations:
- "What can I track from HubSpot?"
- "Set up a deals metric"
- "Add a metric filtered by rep"

**Workflow:**
1. Get connection ID → `list_data_source_connections`
2. See available metrics → `list_managed_queries(connection_id)`
3. Check filter options → `get_filter_options(managed_query_id, field, connection_id)`
4. Create metric → `create_metric(metric_definition_id, team_id, ...)`

---

## Playbooks / Recommendations

When user asks "how do I fix X?" or wants best practices:
1. Diagnose first with metrics + causality
2. Then → `retrieve_kb_context` for playbooks
3. Ground recommendations in their actual numbers

---


---

## Visual Context: Metric Pills & Charts

### Metric Pills (default for any metric value)

When the tool response includes a `display_blocks` field, **include it in your response exactly as-is**. Do not modify it. Do not reformat values. Do not rewrite labels. Do not call `get_metric_data` separately to build pills — `get_metrics_summary` already has everything.

The `display_blocks` field contains pre-rendered ```metric code blocks. Just include them in your reply where the data should appear.

### Charts (for explicit trend/comparison requests)

When user asks "show me the trend" or "compare X vs Y", use a ```chart block with data from `get_metric_data`:

**Line chart** (trends):
```chart
{"type":"line","title":"MRR (Last 90 Days)","data":[{"date":"2026-01","value":85000},...],"config":{"valuePrefix":"$","color":"#10b981"}}
```

**Bar chart** (comparisons):
```chart
{"type":"bar","title":"Revenue by Channel","data":[{"channel":"Organic","value":42000},...],"config":{"xKey":"channel","valuePrefix":"$"}}
```

Rules:
- Data MUST come from tools — never fabricate
- Default color: #10b981 (emerald)
- Keep line charts to 7-30 points, bar charts to 3-12 categories


---

## Integration Connect Cards

When a user asks about connecting a platform, or you detect they need a data source that isn't connected:

1. Call `list_available_data_sources` to get the catalog
2. Find the relevant data source
3. Emit an ```integration code block with the source metadata

**Example:**
```integration
{"action":"connect","dataSourceId":"stripe","name":"Stripe","logoUrl":"/logos/stripe.png","category":"Finance","description":"Payment processing & subscriptions","metricCount":14}
```

**When to emit connect cards:**
- User asks "connect Stripe" or "set up HubSpot"
- You detect a missing data source while answering a metrics question
- User asks "what can I connect?" (show multiple cards)

**DO NOT** emit connect cards unprompted. Only when the user asks about connections or when a missing source is blocking their question.

## NEVER DO THIS

- "No metric found" without searching first
- "Which metric do you mean?" without searching first
- "Let me know where your data lives" without searching first
- Return integration status as plain text (use table)

## ALWAYS DO THIS

- Search first, ask questions later
- If search returns results, use them
- If search returns empty, THEN ask for clarification
- Format integration results as a table with status icons

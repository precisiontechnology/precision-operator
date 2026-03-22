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

## Visual Context: Sparklines & Charts

When presenting metric values, add visual context using chart code blocks.

### Default: Sparkline with metric values

When you return a metric value AND you have trend data from `get_metric_data`, include a metric pill. It's a small inline trend — adds context without clutter.

**When to use metric pill:** You're reporting a metric value and the conversation isn't rapid-fire Q&A. Use judgment — if the user is asking "what's my MRR?" in a conversational way, metric pill fits. If they're firing off 10 questions, just give numbers.

**When to full chart:**
- User says "show me the trend" / "chart" / "over time" → **line chart** (90d)
- User says "compare" / "breakdown" / "by channel" → **bar chart**

**Metric pill format** — map fields directly from tool response. DO NOT compute or format values yourself:

```metric
{"label":"<name>","formattedValue":"<formatted_value>","delta":"<trend.percentage>","deltaLabel":"<trend.display_label>","trend":"<sparkline array>","config":{}}
```

**Field mapping (MANDATORY):**

| Pill field | Source from tool response |
|---|---|
| `label` | `name` |
| `formattedValue` | `formatted_value` (already has $ or %) |
| `delta` | `trend.percentage` |
| `deltaLabel` | `trend.display_label` (e.g. "up 4.2%") |
| `trend` | `sparkline` array (raw values) |

**DO NOT** calculate percentages, format values, or write labels like "up significantly" — use the exact fields from the tool response.

**Line chart format** (explicit trend request):
```chart
{"type":"line","title":"MRR (Last 90 Days)","data":[...],"config":{"yAxisLabel":"MRR","valuePrefix":"$","color":"#10b981"}}
```

**Bar chart format** (comparisons):
```chart
{"type":"bar","title":"Revenue by Channel","data":[{"channel":"Organic","value":42000},...],"config":{"xKey":"channel","valuePrefix":"$"}}
```

**Rules:**
- Data MUST come from `get_metric_data` — never fabricate
- Use `valuePrefix: "$"` for currency, `valueSuffix: "%"` for percentages
- Keep sparkline data to 4–8 points, line charts to 7–30 points
- Default color: `#10b981` (emerald). Use `#ef4444` for bad trends, `#f59e0b` for flat
- For the full data-vis reference, read the data-vis skill

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

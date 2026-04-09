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

## Metric Queries & Operations

**Workflow:**
1. User asks about any metric → `get_metrics_summary` FIRST
2. Need time-series trend → `get_metric_data(metric_id, days)`
3. "Why did X change?" → `explore_causality(metric_id, "upstream")`
4. "Show me the records" → `get_underlying_data(metric_id, date)`
5. "How do I fix this?" → `retrieve_kb_context`

### Metric Management
- **Update metric properties:** `update_metric(metric_id, name, description, unit, direction, dri_id, measurement_frequency, aggregation_type)`
- **Archive/Unarchive:** `archive_metric(metric_id)` / `unarchive_metric(metric_id)`
- **Manual Data Entry:** `update_metric_value(metric_id, date, value)` or `delete_metric_value(metric_id, date)`

---

## Scorecards, Sections & Teams

### Scorecards
- **List/Get:** `list_scorecards` or `get_scorecard(scorecard_id)`
- **Manage:** `create_scorecard(name, team_id, allowed_granularities, default)`, `update_scorecard`, `delete_scorecard`

### Scorecard Structure (Sections & Metrics)
- **Sections:** `create_scorecard_section`, `update_scorecard_section`, `delete_scorecard_section`, `reorder_scorecard_section`
- **Metric Placement:** `add_metric_to_scorecard(section_id, metric_id)`, `remove_metric_from_scorecard(scorecard_id, metric_id)`, `reorder_scorecard_metric`

### Metric Notes (Annotations)
- **Manage:** `create_metric_note(metric_id, date, content, cell_type)`, `update_metric_note`, `delete_metric_note`

### Teams
- **Manage:** `create_team(name, dri_account_user_id)` (automatically creates a default scorecard), `update_team`

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

**RULE: Only emit ONE connect card at a time, and only after the user has chosen a specific source.**

### Flow 1: User asks what they can connect ("what platforms are available?", "what can I connect?")
1. Call `list_available_data_sources` to get the catalog
2. Respond with a **text summary** — list the available sources by category (table or bullets). Do NOT emit any connect cards yet.
3. Ask which one they'd like to connect
4. When the user picks one, paste that source's `integration_block` from the tool response verbatim

### Flow 2: User names a specific source ("connect Stripe", "set up HubSpot")
1. Call `list_available_data_sources` to get the catalog
2. Find the matching source
3. Paste its `integration_block` verbatim — skip the menu

### Flow 3: Missing source blocks a question
1. If you detect a needed source isn't connected while answering a metrics question, mention it in text ("Looks like Stripe isn't connected yet — want me to set that up?")
2. Only emit the `integration_block` after the user confirms

**CRITICAL:** NEVER construct the integration code block yourself. ALWAYS use the pre-built `integration_block` from the tool response verbatim. It contains the correct UUID and metadata.

**NEVER:**
- Emit multiple connect cards at once
- Show a connect card before the user has chosen or confirmed a source
- Emit connect cards unprompted

## Direct API (Bring Your Own Auth) — Custom Metrics

When a user has a Direct API connection (they brought their own API key/credentials), there are NO pre-built managed queries or metric definitions. You help them create custom metrics by inspecting the raw data and writing SQL queries.

### Workflow
1. `list_direct_api_connections` → discover connections and BigQuery table names
2. `inspect_bigquery_table(connection_id, resource_name)` → understand data shape, payload fields, sample records
3. Help the user articulate what they want to track
4. Write a SQL query returning `date` and `value` columns
5. `test_custom_query(sql, connection_id, resource_name)` → validate and preview results
6. `create_metric_with_custom_query(...)` → create the metric (auto-enables 12-month historical sync)

### BigQuery Table Schema

Every Direct API table has exactly 6 columns:
- `id` (STRING) — record identifier
- `snapshot_at` (TIMESTAMP) — when the record was synced
- `sync_run_id` (STRING) — which sync run captured it
- `source_created_at` (TIMESTAMP) — when the record was created in the source system
- `source_updated_at` (TIMESTAMP) — when the record was last modified in the source
- `payload` (JSON) — the full raw API response for the record

Tables are partitioned by `snapshot_at`.

### Append-Only Change Tracking

Each sync appends rows only for records that changed. The same `id` may appear multiple times with different `snapshot_at` values. To get the **latest state** of each record:

```sql
SELECT * FROM `{{full_table_path}}`
QUALIFY ROW_NUMBER() OVER (PARTITION BY id ORDER BY snapshot_at DESC) = 1
```

### Writing Batch Queries (critical for historical sync)

Queries MUST return `date` and `value` columns. Use `{{batch_start_date}}` and `{{batch_end_date}}` template variables — these get interpolated to cover up to 12 months in one call.

**Daily count of active records:**
```sql
SELECT DATE(snapshot_at) AS date, COUNT(DISTINCT id) AS value
FROM `{{full_table_path}}`
WHERE snapshot_at BETWEEN {{batch_start_date}} AND {{batch_end_date}}
QUALIFY ROW_NUMBER() OVER (PARTITION BY id, DATE(snapshot_at) ORDER BY snapshot_at DESC) = 1
GROUP BY date ORDER BY date
```

**Daily revenue from paid invoices:**
```sql
SELECT DATE(snapshot_at) AS date,
  SUM(CAST(JSON_VALUE(payload, '$.amount') AS FLOAT64)) / 100 AS value
FROM `{{full_table_path}}`
WHERE snapshot_at BETWEEN {{batch_start_date}} AND {{batch_end_date}}
  AND JSON_VALUE(payload, '$.status') = 'paid'
QUALIFY ROW_NUMBER() OVER (PARTITION BY id, DATE(snapshot_at) ORDER BY snapshot_at DESC) = 1
GROUP BY date ORDER BY date
```

### JSON Payload Extraction

```sql
JSON_VALUE(payload, '$.email')                                    -- string field
CAST(JSON_VALUE(payload, '$.amount') AS FLOAT64)                  -- numeric field
JSON_VALUE(payload, '$.address.city')                             -- nested field
PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%S', JSON_VALUE(payload, '$.created_at'))  -- timestamp
```

### Dataset / Table Naming

- Dataset: `{account_id}__raw_snapshots` (UUIDs: hyphens → underscores)
- Table: `{connection_id}__raw__{category}__{source}__{resource_name}`

---

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

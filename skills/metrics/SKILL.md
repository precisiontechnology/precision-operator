---
name: metrics
description: Create and configure metrics. Supports integration (from data sources), direct entry (manual), and calculated (formula) types. Use when user wants to add, set up, filter, configure, or create metrics of any kind.
---

# Metrics Configuration Skill

## When to Use

Trigger on:
- "Create a metric for..."
- "Set up tracking for..."
- "Add a metric filtered by..."
- "Configure [metric name]"
- "Track [metric] by [filter]"
- "Create a manual metric..." / "I'll update it myself"
- "Create a calculated metric..." / "metric that adds/divides/multiplies..."
- "Give me a metric that computes..."

---

## Metric Types Overview

There are three types of metrics. Determine which type to use from user intent:

| Type | When to use | Key fields |
|------|------------|------------|
| **integration** | Metric pulled automatically from a connected data source (Stripe, HubSpot, etc.) | metric_definition_id, connection_id |
| **direct_entry** | User manually enters values (NPS, survey results, anything they track themselves) | name, unit, direction, measurement_frequency |
| **calculated** | Auto-computed formula referencing other existing metrics (Conversion Rate = Demos / MQLs) | name, formula_expression or calculation_formula |

**If the user says "I'll update it manually", "I'll enter it weekly", "it's a number we track ourselves" → direct_entry.**
**If the user says "it's X divided by Y", "add these two metrics", "compute from other metrics" → calculated.**
**If it comes from a data source connection → integration.**

---

## BEFORE Creating Any Metric

### Step 1: Exhaustive Search Protocol (MANDATORY for ALL types)

**NEVER say "metric doesn't exist" until you've completed ALL of these:**

```
1. get_metrics_summary("exact name user mentioned")
2. get_metrics_summary("key term") — try 2-3 variations
3. get_metric_by_name("exact name")
4. get_metric_by_name("partial name")
```

Only after 3+ search attempts can you say a metric doesn't exist.

When you DO find matches:
- Show user any similar metrics that already exist
- Ask: "I found these existing metrics — do any of these work, or should I create a new one?"

---

## Workflow by Type

### Integration Metrics (from data source)

```
1. list_data_source_connections → Get connection_id
2. list_managed_queries(connection_id) → See available metric definitions
3. get_metrics_summary → Check for existing/similar metrics
4. [If filters needed] get_filter_options(managed_query_id, field, connection_id)
5. CONFIRM with user: filters + aggregation + pacing + direction
6. create_metric(data_type: "integration", metric_definition_id, team_id, connection_id, name, filters)
```

### Direct Entry Metrics (manual)

```
1. get_metrics_summary → Check for existing/similar metrics
2. Determine: unit, direction, measurement_frequency (ask if unclear)
3. CONFIRM with user: name + all settings
4. create_metric(data_type: "direct_entry", name, team_id, unit, direction, measurement_frequency)
```

No connection or definition needed. User will enter values manually via scorecard.

Required fields to gather before creating:
- `name` — clear, descriptive metric name
- `unit` — integer, decimal, percentage, currency, minutes, hours, days
- `direction` — more_is_better or less_is_better
- `measurement_frequency` — daily, weekly, monthly

### Calculated Metrics (formula)

```
1. get_metrics_summary → Find the metrics referenced in the formula
2. Confirm metric names match exactly what exists
3. CONFIRM formula with user before creating
4. create_metric(data_type: "calculated", name, team_id, formula_expression: "MQLs + SQLs")
```

Use `formula_expression` as a natural language string — the tool resolves metric names to UUIDs automatically. If a name is ambiguous (multiple matches), the tool will tell you — ask the user to clarify.

Formula expression examples:
- `"MQLs + SQLs"` — adds two metrics
- `"(Demos Booked / MQLs) * 100"` — conversion rate as percentage
- `"Revenue - COGS"` — gross profit

**If formula references metrics that don't exist yet, create those first.**

---

## Shared Settings (direct_entry and calculated)

| Setting | Options | Guidance |
|---------|---------|----------|
| **unit** | integer, decimal, percentage, currency, minutes, hours, days | Infer from context ("conversion rate" = percentage, "NPS score" = integer) |
| **direction** | more_is_better, less_is_better | Revenue/customers = more. Churn/CAC/tickets = less. |
| **measurement_frequency** | daily, weekly, monthly | "I'll update it weekly" = weekly |
| **aggregation_type** | sum, latest, average | See guidance below |
| **pacing_type** | linear_growth, direct_comparison | See guidance below |

---

## Aggregation Guidance

**Use `latest` for:**
- Percentages (conversion rate, churn rate)
- MRR / ARR / recurring revenue
- Active subscribers / customer counts
- Balance-type metrics (what's the current state?)

**Use `sum` for:**
- Leads generated, deals closed, cash collected, new sales
- Flow-type metrics (what happened this period?)

**Use `average` for:**
- Average deal size, NPS score, response time

---

## Pacing Type Guidance

**Use `linear_growth` for:** Cumulative metrics that grow over time (MRR, total customers)
**Use `direct_comparison` for:** Period-over-period snapshots (this week vs last week)

---

## Filter Format (integration metrics only)

```json
{
  "filters": [
    {"field": "item_product_id", "values": ["prod_123"]},
    {"field": "status", "values": ["active", "trial"]}
  ]
}
```

- Multiple values in one field = OR (active OR trial)
- Multiple fields = AND
- Complex nested logic → create without filters, tell user to configure manually in Settings

---

## Example Conversations

**Integration metric:**
> User: "Set up a metric for Growth Accelerator subscribers"
> 1. Check existing → show similar
> 2. Get filter options for product field
> 3. Confirm: "I'll create **Growth Accelerator - Active Subscribers** filtered by product = Growth Accelerator. Aggregation: latest. Pacing: linear_growth. Direction: more is better. Confirm?"
> 4. create_metric(data_type: "integration", ...)

**Direct entry metric:**
> User: "Create a manual metric called NPS Score, I'll update it monthly"
> 1. Check existing → none found
> 2. Infer: unit = integer, direction = more_is_better, frequency = monthly
> 3. Confirm: "I'll create **NPS Score** as a manual metric you update monthly. Unit: integer. Direction: more is better. Confirm?"
> 4. create_metric(data_type: "direct_entry", name: "NPS Score", unit: "integer", direction: "more_is_better", measurement_frequency: "monthly", team_id: ...)

**Calculated metric:**
> User: "Create a conversion rate metric that divides Demos Booked by MQLs"
> 1. Confirm both metrics exist via search
> 2. Confirm: "I'll create **Conversion Rate** calculated as Demos Booked / MQLs. Unit: percentage. Direction: more is better. Confirm?"
> 3. create_metric(data_type: "calculated", name: "Conversion Rate", formula_expression: "Demos Booked / MQLs", unit: "percentage", direction: "more_is_better", team_id: ...)

---

## NEVER DO THIS

- Say "metric not found" after only ONE search — exhaustive search is MANDATORY
- Create a metric without checking for duplicates first
- Assume integration type when user says they'll update it manually
- Start building a formula before confirming the referenced metrics exist
- Guess at aggregation/pacing/direction without asking if context is unclear
- Create metrics with complex nested filters (tell user to configure manually)

## ALWAYS DO THIS

- Search existing metrics first
- Determine metric type from user intent BEFORE starting the workflow
- Confirm all settings explicitly before creating
- For calculated: verify referenced metrics exist before building formula
- Explain what each setting means in context of their metric

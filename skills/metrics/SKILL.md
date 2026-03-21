---
name: metrics
description: Create and configure metrics from integrations. Use when user wants to add, set up, filter, or configure metric tracking from their connected data sources.
---

# Metrics Configuration Skill

## When to Use

Trigger on:
- "Create a metric for..."
- "Set up tracking for..."
- "Add a metric filtered by..."
- "Configure [metric name]"
- "Track [metric] by [filter]"

---

## BEFORE Creating Any Metric

### Step 1: Exhaustive Search Protocol (MANDATORY)

**NEVER say "metric doesn't exist" until you've completed ALL of these:**

```
1. get_metrics_summary("exact name user mentioned")
2. get_metrics_summary("key term") — try 2-3 variations (e.g., "customers", "subscribers", "active")
3. get_metric_by_name("exact name") — this is more precise than summary
4. get_metric_by_name("partial name") — try the product/program name alone
```

**Search harder before saying "not found."** If user asks for "Growth Accelerator customers":
- ❌ WRONG: Search "growth accelerator customers" once → "not found"
- ✅ RIGHT: Search "growth accelerator customers", "customers", "active subscribers", "growth accelerator" via BOTH summary AND by_name

**Only after 3+ search attempts across both tools can you say a metric doesn't exist.**

When you DO find matches:
- Show user any similar metrics that already exist
- Ask: "I found these existing metrics - do any of these work, or should I create a new one?"

### Step 2: Confirm Filter Criteria

**ALWAYS tell the user exactly what you're filtering on before creating.**

Example confirmation:
> "I'll create **Active Subscribers** filtered by:
> - **Product:** Growth Accelerator (prod_U0JKzTHxBgZcqT)
> 
> This will count only subscribers on the Growth Accelerator program, excluding SaaS Academy and other products. Confirm?"

### Step 3: Gather Required Settings

Before creating, you MUST know:

| Setting | Options | Guidance |
|---------|---------|----------|
| **Aggregation** | sum, latest, average | See guidance below |
| **Pacing Type** | linear_growth, direct_comparison | See guidance below |
| **Direction** | more_is_better, less_is_better | What does success look like? |

---

## Aggregation Guidance

**Use `latest` for:**
- Percentages (conversion rate, close rate, churn rate)
- MRR / ARR / recurring revenue
- Active subscribers / customer counts
- Balance-type metrics (what's the current state?)

**Use `sum` for:**
- Leads generated
- Deals closed (count)
- Cash collected
- New sales
- Flow-type metrics (what happened this period?)

**Use `average` for:**
- Average deal size
- Average response time
- NPS score
- Rating-type metrics

**Rule of thumb:** If you're counting "how many total right now" → latest. If you're counting "how many this week/month" → sum.

---

## Pacing Type Guidance

**Use `linear_growth` for:**
- Cumulative metrics that grow over time
- MRR, ARR, total customers
- Metrics where you expect steady progress toward a target

**Use `direct_comparison` for:**
- Period-over-period metrics
- This week vs last week
- Metrics where you compare snapshots, not growth

---

## Direction Guidance

**`more_is_better`:** Revenue, customers, leads, conversion rates, NPS
**`less_is_better`:** Churn, refunds, support tickets, response time, CAC

---

## Metric Creation Workflow

```
1. list_data_source_connections → Get connection_id
2. list_managed_queries(connection_id) → See available metric definitions
3. get_metrics_summary → Check for existing/similar metrics
4. [If filters needed] get_filter_options(managed_query_id, field, connection_id)
5. CONFIRM with user: filters + aggregation + pacing + direction
6. create_metric(metric_definition_id, team_id, connection_id, name, filters)
```

---

## Filter Format

**Simple format for create_metric:**
```json
{
  "filters": [
    {"field": "item_product_id", "values": ["prod_123"]},
    {"field": "status", "values": ["active", "trial"]}
  ]
}
```

- Multiple values in one field = OR (active OR trial)
- Multiple fields = AND (product X AND status active)
- For complex nested AND/OR logic → create without filters, tell user to configure manually in Settings

---

## Filterable vs Non-Filterable Metrics

**Filterable metrics:** Can create multiple instances with different filters
- Example: Active Subscribers (SaaS Academy) + Active Subscribers (Growth Accelerator)

**Non-filterable metrics:** Only one instance per connection per team
- Check `filterable: true/false` in list_managed_queries response

---

## Example Conversation

**User:** "Set up a metric for Growth Accelerator subscribers"

**Claudia:**
1. ✅ Check existing: `get_metrics_summary("subscribers Growth Accelerator")`
2. ✅ Show results: "I found 'Active Subscribers' but it's tracking all products. Want me to create a filtered version?"
3. ✅ Get filter options: `get_filter_options(query_id, "item_product_id", connection_id)`
4. ✅ Confirm: "I'll create **Growth Accelerator - Active Subscribers** filtered by product = Growth Accelerator. Aggregation: **latest** (it's a count of current subscribers). Pacing: **linear_growth**. Direction: **more is better**. Confirm?"
5. ✅ Create after user confirms

---

## NEVER DO THIS

- **Say "metric not found" after only ONE search** — exhaustive search is MANDATORY
- Create a metric without checking for duplicates first
- Create a filtered metric without confirming the exact filter values
- Guess at aggregation/pacing/direction without asking
- Create metrics with complex nested filters (tell user to configure manually)
- Use only `get_metrics_summary` — always try `get_metric_by_name` as fallback

## ALWAYS DO THIS

- Search existing metrics first
- Show similar metrics before creating new ones
- Confirm filter criteria explicitly
- Ask about aggregation, pacing, direction if not specified
- Explain what each setting means in context of their metric

# Metrics Skill

Query, create, configure, and drill into business metrics.

## When to Use

**Querying metrics:**
- "What's my MRR?"
- "Show me churn rate"
- "What are my key metrics?"
- "Trend of revenue over 90 days"

**Creating/configuring metrics:**
- "What metrics can I track from HubSpot?"
- "Set up a deals metric"
- "Add a metric filtered by sales rep"
- "What filters are available?"

**Drilling into data:**
- "What's driving this number?"
- "Show me the actual deals"
- "Why did this metric change?"
- "What caused the drop?"

## Tools

### Querying
- `get_metrics_summary` — Search metrics by name/query. Use FIRST for any metric question.
- `get_metric_data` — Get time-series trend data for a specific metric
- `get_metric_by_name` — Look up a metric by exact name

### Drilling In
- `get_underlying_data` — Get the individual records behind a metric value
- `explore_causality` — Trace upstream causes or downstream effects

### Creating/Configuring
- `list_managed_queries` — See what metrics can be created from a data source
- `get_filter_options` — Get available filter values (stages, reps, pipelines, etc.)
- `create_metric` — Create a new metric from a template

## Workflow: Answering Metric Questions

1. **Search** → `get_metrics_summary` (find the metric)
2. **Trend** → `get_metric_data` (see how it's changing)
3. **Why** → `explore_causality` (find root cause)
4. **Drill** → `get_underlying_data` (see actual records)

Always start with search. Don't skip steps.

## Workflow: Creating a Metric

1. **Get connection ID** → use `list_data_source_connections` (integrations skill)
2. **See available metrics** → `list_managed_queries(connection_id)`
3. **Check filters** → `get_filter_options(managed_query_id, field, connection_id)`
4. **Create** → `create_metric(metric_definition_id, team_id, ...)`

## Output Guidelines
- Lead with the number/answer, then context
- Use tables for multi-metric comparisons
- Include trend direction (↑ ↓ →) when showing changes
- When drilling in, summarize key records, don't dump raw data

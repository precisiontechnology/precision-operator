---
name: data-vis
description: Data visualization guidance for Claudia. Use when surfacing metrics, trends, comparisons, or summaries. Teaches chart type selection, timeframe logic, and the metric pill pattern.
---

# Data Visualization Skill

## Core Principle

**Show data visually by default.** Don't wait for users to ask for charts — every metric mention should have a visual companion.

---

## Trigger Rules

| User says... | You do... |
|---|---|
| "What's my MRR?" / any single metric question | **Metric pill** from `display_blocks` |
| "Show me MRR" / "MRR trend" / "how's X trending" | **Line chart** (90d default) |
| "Compare X vs Y" / "by channel" / "by team" / "breakdown" | **Bar chart** (latest period) |
| "Give me a summary" / "weekly recap" / "how are things" | **Metric pill per metric** from `display_blocks` |

---

## Chart Type Selection

```
Single metric + just asking the value    → METRIC PILL (from display_blocks)
Single metric + "trend" / "over time"    → LINE chart (90d default)
Comparing 2+ categories or segments      → BAR chart
Summary / recap / multiple metrics       → METRIC PILL per metric (from display_blocks)
```

### Available types

- **metric pill** — Compact card with label, value, 30d micro-trend, and period-over-period delta. Rendered from ```metric code blocks. **Always comes from `display_blocks` in tool response — never build these yourself.**
- **line** — Time series. XAxis with dates, YAxis with values, hover tooltips. Use for trend requests.
- **bar** — Categorical comparison. XAxis with categories, YAxis with values. Use for breakdowns.

---

## Metric Pills

**These are deterministic — Rails builds them, you paste them.**

When `get_metrics_summary` returns results, the response includes a `display_blocks` field with pre-rendered ```metric code blocks. Include them in your response exactly as-is.

**DO NOT:**
- Call `get_metric_data` just to build a pill
- Compute values, percentages, or labels yourself
- Modify the `display_blocks` content in any way

The pill includes: label, formatted value, period-over-period delta, 30d sparkline trend, metric direction (for color coding), and prior period value (for tooltip). All computed by Rails.

---

## Charts (Line & Bar)

For explicit trend or comparison requests, build a ```chart code block using data from `get_metric_data`.

### Line chart (trends):

```chart
{"type":"line","title":"MRR (Last 90 Days)","data":[{"date":"2026-01","value":85000},{"date":"2026-02","value":92000},{"date":"2026-03","value":98500}],"config":{"yAxisLabel":"MRR","valuePrefix":"$","color":"#10b981"}}
```

### Bar chart (comparisons):

```chart
{"type":"bar","title":"Revenue by Channel (March)","data":[{"channel":"Organic","value":42000},{"channel":"Paid Ads","value":28000},{"channel":"Referral","value":18500}],"config":{"xKey":"channel","valuePrefix":"$","color":"#10b981"}}
```

---

## Timeframe Selection (for charts only)

Pick the timeframe based on the data:

1. **Line charts:** 90 days default
2. **Weekly metrics** (e.g., weekly revenue): Show 12 weeks, not 90 individual days
3. **Monthly metrics** (e.g., monthly churn rate): Show 6–12 months
4. **If user specifies a range:** Honor it exactly
5. **If data is sparse** (< 5 data points in chosen range): Widen the range

---

## Data Formatting Rules (for charts only)

1. **Always get fresh data from `get_metric_data`** — never fabricate data points
2. **Detect value format** from the metric:
   - Currency → `"valuePrefix": "$"`
   - Percentage → `"valueSuffix": "%"`
   - Count → no prefix/suffix
3. **Round sensibly:** Currency = whole dollars, percentages = 1 decimal, counts = whole numbers
4. **X-axis labels:**
   - < 30 days: Dates ("Mar 15")
   - 30–90 days: Week or biweekly labels
   - > 90 days: Month abbreviations ("Jan", "Feb")
5. **Title:** Metric name + timeframe — "MRR (Last 90 Days)"
6. **Max data points:** 7–30 for line charts, 3–12 for bar charts
7. **Color:** Default `#10b981` (emerald). Use `#ef4444` (red) for bad trends. Use `#f59e0b` (amber) for flat.

---

## When NOT to Chart

- Single counts with no trend (e.g., "You have 3 integrations")
- Yes/no status questions
- Configuration or setup information
- Anything with < 3 data points — just state the numbers

---

## Chart JSON Schema

```json
{
  "type": "line | bar",
  "title": "Metric Name (Timeframe)",
  "data": [
    {"date": "2026-01-01", "value": 85000},
    {"date": "2026-02-01", "value": 92000}
  ],
  "config": {
    "xKey": "date",
    "yKey": "value",
    "valuePrefix": "$",
    "valueSuffix": "%",
    "yAxisLabel": "Revenue",
    "color": "#10b981"
  }
}
```

- `xKey` default: "date" — change for bar charts (e.g., "channel", "team")
- `yKey` default: "value"
- `config` is optional — defaults work for most cases
- JSON must be valid — no trailing commas, no comments

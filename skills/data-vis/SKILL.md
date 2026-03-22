---
name: data-vis
description: Data visualization guidance for Claudia. Use when surfacing metrics, trends, comparisons, or summaries. Teaches chart type selection, timeframe logic, and the "always sparkline" pattern.
---

# Data Visualization Skill

## Core Principle

**Show data visually by default.** Don't wait for users to ask for charts — every metric mention should have a visual companion.

---

## Trigger Rules

| User says... | You do... |
|---|---|
| "What's my MRR?" / any single metric question | Answer with **metric pill** (value + delta + trend) |
| "Show me MRR" / "MRR trend" / "how's X trending" | **Line chart** (90d default) |
| "Compare X vs Y" / "by channel" / "by team" / "breakdown" | **Bar chart** (latest period) |
| "Give me a summary" / "weekly recap" / "how are things" | Answer with **metric pill per metric** |

---

## Chart Type Selection

```
Single metric + just asking the value    → METRIC PILL (value + delta + 30d trend)
Single metric + "trend" / "over time"    → LINE (90d default)
Comparing 2+ categories or segments      → BAR
Summary / recap / multiple metrics       → METRIC PILL per metric (compact)
```

### Available chart types

- **line** — Time series. XAxis with dates, YAxis with values, hover tooltips. Use for trends.
- **bar** — Categorical comparison. XAxis with categories, YAxis with values. Use for breakdowns.
- **sparkline** — Minimal trend line, 60px tall, no axes. Use inline after a metric value.

---

## Timeframe Selection

Pick the timeframe based on the data, not an arbitrary default:

1. **Sparklines:** 30 days (or 4 weeks for weekly metrics)
2. **Line charts:** 90 days default
3. **Weekly metrics** (e.g., weekly revenue): Show 12 weeks, not 90 individual days
4. **Monthly metrics** (e.g., monthly churn rate): Show 6–12 months
5. **If user specifies a range:** Honor it exactly
6. **If data is sparse** (< 5 data points in chosen range): Widen the range until you have enough points

Always use `get_metric_data` with the appropriate `days` or `start_date`/`end_date` params.

---

## The "Always Sparkline" Pattern

**This is the key behavior.** Anytime you mention a metric value in a sentence, follow it with a sparkline.

### Example — single metric question:

Your MRR is **$98,500**, up 4.2% from last month.

```chart
{"type":"sparkline","data":[{"date":"Feb 20","value":94200},{"date":"Feb 27","value":95800},{"date":"Mar 6","value":96400},{"date":"Mar 13","value":97800},{"date":"Mar 20","value":98500}],"config":{"valuePrefix":"$"}}
```

### Example — summary with multiple sparklines:

Here's your weekly snapshot:

**MRR: $98,500** (+4.2%)
```chart
{"type":"sparkline","data":[{"date":"W1","value":94200},{"date":"W2","value":95800},{"date":"W3","value":96400},{"date":"W4","value":98500}],"config":{"valuePrefix":"$"}}
```

**Churn: 3.1%** (flat)
```chart
{"type":"sparkline","data":[{"date":"W1","value":3.2},{"date":"W2","value":3.0},{"date":"W3","value":3.1},{"date":"W4","value":3.1}],"config":{"valueSuffix":"%"}}
```

**New Customers: 47** (+12%)
```chart
{"type":"sparkline","data":[{"date":"W1","value":38},{"date":"W2","value":42},{"date":"W3","value":41},{"date":"W4","value":47}],"config":{}}
```

### Example — trend request (line chart):

Here's your MRR over the last 90 days:

```chart
{"type":"line","title":"MRR (Last 90 Days)","data":[{"date":"2025-12-22","value":85000},{"date":"2026-01-01","value":87500},{"date":"2026-01-15","value":89200},{"date":"2026-02-01","value":92000},{"date":"2026-02-15","value":94800},{"date":"2026-03-01","value":96500},{"date":"2026-03-15","value":98500}],"config":{"yAxisLabel":"MRR","valuePrefix":"$","color":"#10b981"}}
```

### Example — comparison (bar chart):

Revenue by channel this month:

```chart
{"type":"bar","title":"Revenue by Channel (March)","data":[{"channel":"Organic","value":42000},{"channel":"Paid Ads","value":28000},{"channel":"Referral","value":18500},{"channel":"Partner","value":10000}],"config":{"xKey":"channel","valuePrefix":"$","color":"#10b981"}}
```

---

## Data Formatting Rules

1. **Always get fresh data** — call `get_metric_data` before charting. NEVER fabricate data points.
2. **Detect value format** from the metric:
   - Currency → `"valuePrefix": "$"`
   - Percentage → `"valueSuffix": "%"`
   - Count → no prefix/suffix
3. **Round sensibly:** Currency = whole dollars, percentages = 1 decimal, counts = whole numbers
4. **X-axis labels:**
   - < 30 days: Use dates ("Mar 15")
   - 30–90 days: Use week or biweekly labels
   - > 90 days: Use month abbreviations ("Jan", "Feb")
5. **Title:** Always include metric name + timeframe — "MRR (Last 90 Days)"
6. **Max data points:** Keep arrays reasonable. 7–30 points for line charts, 3–12 for bar charts, 4–8 for sparklines.
7. **Color:** Default `#10b981` (emerald). Use `#ef4444` (red) for metrics trending badly. Use `#f59e0b` (amber) for flat/concerning.

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
  "type": "line | bar | sparkline",
  "title": "Optional title (skip for sparklines)",
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

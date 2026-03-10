---
name: precision
description: Query Precision business metrics, diagnose bottlenecks, trace causality, and retrieve playbooks. Use when user asks about MRR, churn, revenue, goals, metrics, leads, sales, or "why" something changed.
---

# Precision Operator Skill

## CRITICAL: Always Search First

NEVER say "no metric found" or ask clarifying questions before searching.

When user asks about ANY metric:
1. FIRST call get_metrics_summary with their query
2. ONLY if results are empty, then ask for clarification
3. Never assume a metric doesn't exist

## API Base

https://precision.ngrok.app/api/v1/operator

## Auth

All requests require:
- Header: Authorization: Bearer ${PRECISION_API_TOKEN}
- Header: Content-Type: application/json

## Tools

### Get Metrics Summary
POST /api/v1/operator/get_metrics_summary
Body: query, diagnostic_mode, limit

### Explore Causality
POST /api/v1/operator/explore_causality
Body: metric_id, direction (upstream/downstream/both), depth

### Get Metric Data
POST /api/v1/operator/get_metric_data
Body: metric_id, days, start_date, end_date, time_expression

### Get Metric By Name
POST /api/v1/operator/get_metric_by_name
Body: metric_name

### Retrieve KB Context
POST /api/v1/operator/retrieve_kb_context
Body: query

## Workflow

1. User asks about any metric → IMMEDIATELY call get_metrics_summary
2. Need specific time range → get_metric_data with dates
3. Why questions → explore_causality direction upstream
4. How to fix → retrieve_kb_context

## NEVER DO THIS

- "No metric found" without searching first
- "Which metric do you mean?" without searching first
- "Let me know where your data lives" without searching first

## ALWAYS DO THIS

- Search first, ask questions later
- If search returns results, use them
- If search returns empty, THEN ask for clarification

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

## Workflow

1. User asks about any metric → IMMEDIATELY call get_metrics_summary
2. Need specific time range → get_metric_data with metric_id from results
3. "Why" questions → explore_causality with direction: upstream
4. "How to fix" questions → retrieve_kb_context

## NEVER DO THIS

- "No metric found" without searching first
- "Which metric do you mean?" without searching first
- "Let me know where your data lives" without searching first

## ALWAYS DO THIS

- Search first, ask questions later
- If search returns results, use them
- If search returns empty, THEN ask for clarification

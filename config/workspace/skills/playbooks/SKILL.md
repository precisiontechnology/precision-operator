---
name: playbooks
description: Access best practices, growth strategies, and recommendations. Use when user asks how to fix something, wants advice, or needs playbooks for growth.
---

# Playbooks Skill

Access best practices, growth strategies, and recommendations from the Precision knowledge base.

## When to Use
- "How do I fix churn?"
- "Best practices for onboarding"
- "How do I improve trial conversion?"
- "What should I do about X?"
- "Give me strategies for growth"
- "How do other SaaS companies handle this?"

## Tools
- `retrieve_kb_context` — Search the knowledge base for playbooks and strategies

## Workflow

1. **Diagnose first** — Before recommending fixes, understand the problem
   - Use metrics skill to see current state
   - Use `explore_causality` to find root cause
2. **Then prescribe** — `retrieve_kb_context` for relevant playbooks
3. **Ground in data** — Tie recommendations back to their specific numbers

## Response Guidelines
- Don't give generic advice — tie to their actual metrics
- Prioritize: What's the ONE thing that will move the needle most?
- Be specific: "Reduce time-to-value from 14 days to 7" not "improve onboarding"
- Include expected impact when possible
- Suggest how to measure success

## Example Flow

User: "How do I reduce churn?"

1. Check churn metric → `get_metrics_summary("churn")`
2. See trend → `get_metric_data(metric_id, days=90)`
3. Find cause → `explore_causality(metric_id, "upstream")`
4. Get playbooks → `retrieve_kb_context("reduce churn for [identified cause]")`
5. Recommend with specifics grounded in their data

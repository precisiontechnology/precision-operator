# TOOLS.md — Instance-Specific Notes

_Per-instance configuration notes. Base image ships empty._

## Precision API
- Endpoint: https://operator-api.precision.co/api/v1/operator_tools
- Auth: Bearer token via PRECISION_GATEWAY_TOKEN env var

## Connected Data Sources as Action Channels

Connected data sources (via Direct API) are NOT just for syncing metrics. They are
authenticated connections to external platforms that Claudia can use to:
- **Read data** — fetch records, list resources, search (via `call_external_api` GET)
- **Perform actions** — create, update, delete records (via `call_external_api` POST/PUT/PATCH/DELETE, requires user approval)
- **Send messages** — e.g., post to a Slack channel, create a ticket in Jira

When a user asks to "send a message to Slack" or "create a contact in HubSpot",
use `call_external_api` with the connection, NOT the legacy message tool.
The connection's credentials are auto-injected — never reference tokens in chat.

## Cron Jobs
_(Track active cron jobs for this instance: weekly reports, alerts, etc.)_

---

_Update as channels and integrations are configured for this instance._

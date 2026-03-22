const BASE = process.env.PRECISION_API_URL || "https://operator-api.precision.co/api/v1/operator";
const GATEWAY_TOKEN = process.env.PRECISION_GATEWAY_TOKEN;

let currentUserId: string | undefined;

function parseSessionKey(sessionKey: string): { accountId?: string; userId?: string } {
  // OpenClaw prepends "agent:main:" to our sessionKey, so full format is:
  // "agent:main:{account_id}:{user_id}::{ignored}" or "agent:main:{account_id}:{user_id}"
  // UUIDs are case-insensitive so lowercasing is fine
  const parts = sessionKey.split(":");
  // Skip "agent" and "main" prefix, then account_id and user_id
  // parts: ["agent", "main", account_uuid_part1, ..., user_uuid, ...]
  // UUIDs contain hyphens not colons, so after "agent:main:" the next UUID is the account_id
  const withoutPrefix = sessionKey.replace(/^agent:main:/, "");
  const doubleColonIdx = withoutPrefix.indexOf("::");
  const identityPart = doubleColonIdx === -1 ? withoutPrefix : withoutPrefix.substring(0, doubleColonIdx);
  // identityPart = "account_uuid:user_uuid"
  const colonIdx = identityPart.indexOf(":");
  if (colonIdx === -1) return { accountId: identityPart };
  const accountId = identityPart.substring(0, colonIdx);
  const userId = identityPart.substring(colonIdx + 1);
  return { accountId, userId };
}

async function callPrecision(endpoint: string, body: Record<string, unknown>) {
  if (!GATEWAY_TOKEN) {
    return { content: [{ type: "text" as const, text: "Error: PRECISION_GATEWAY_TOKEN not configured." }] };
  }

  const url = `${BASE}/${endpoint}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${GATEWAY_TOKEN}`,
    "Content-Type": "application/json",
  };

  if (currentUserId) {
    headers["X-Operator-User-Id"] = currentUserId;
  }

  console.log(`[precision-plugin] ${endpoint} → ${url} (user: ${currentUserId || "none"})`);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      return { content: [{ type: "text" as const, text: `Precision API error (${res.status}): ${text}` }] };
    }
    return { content: [{ type: "text" as const, text }] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Precision API request failed: ${message}` }] };
  }
}

export default function (api: any) {
  api.on("before_agent_start", (_event: any, ctx: any) => {
    const sessionKey = ctx?.sessionKey;
    if (!sessionKey) return;
    const { accountId, userId } = parseSessionKey(sessionKey);
    console.log(`[precision-plugin] session: account=${accountId}, user=${userId}`);
    if (userId) {
      currentUserId = userId;
    }
  });

  api.registerTool({
    name: "get_metrics_summary",
    description:
      "Search and retrieve business metrics by query. Use this FIRST whenever a user asks about any metric. Returns matching metrics with current values, trends, and status.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query (e.g. 'MRR', 'churn rate', 'revenue')" },
        diagnostic_mode: { type: "boolean", description: "Enable diagnostic mode for richer output" },
        limit: { type: "number", description: "Max number of results to return" },
      },
      required: ["query"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      return callPrecision("get_metrics_summary", params);
    },
  });

  api.registerTool({
    name: "get_metric_data",
    description:
      "Get time-series data for a specific metric. Use after get_metrics_summary to pull trends over a date range.",
    parameters: {
      type: "object",
      properties: {
        metric_id: { type: "string", description: "The metric ID from get_metrics_summary results" },
        days: { type: "number", description: "Number of days of data to return" },
        start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
        end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
        time_expression: { type: "string", description: "Natural language time range (e.g. 'last 90 days')" },
      },
      required: ["metric_id"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      return callPrecision("get_metric_data", params);
    },
  });

  api.registerTool({
    name: "get_metric_by_name",
    description: "Look up a metric by its exact name. Use when you know the specific metric name.",
    parameters: {
      type: "object",
      properties: {
        metric_name: { type: "string", description: "Exact metric name" },
      },
      required: ["metric_name"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      return callPrecision("get_metric_by_name", params);
    },
  });

  api.registerTool({
    name: "explore_causality",
    description:
      "Trace upstream and downstream causal relationships for a metric. Use for 'why' questions — finds root causes (upstream) or downstream impact.",
    parameters: {
      type: "object",
      properties: {
        metric_id: { type: "string", description: "The metric ID to explore" },
        direction: {
          type: "string",
          enum: ["upstream", "downstream", "both"],
          description: "Direction to explore: upstream (causes), downstream (effects), or both",
        },
        depth: { type: "number", description: "How many levels deep to trace (default: 2)" },
      },
      required: ["metric_id"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      return callPrecision("explore_causality", params);
    },
  });

  api.registerTool({
    name: "retrieve_kb_context",
    description:
      "Search the Precision knowledge base for playbooks, best practices, and growth strategies. Use for 'how to fix' questions after diagnosing with metrics and causality.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for (e.g. 'improve trial to paid conversion', 'reduce churn')" },
      },
      required: ["query"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      return callPrecision("retrieve_kb_context", params);
    },
  });

  api.registerTool({
    name: "list_managed_queries",
    description:
      "List available metric templates (managed queries) for a connected data source. Use this to discover what metrics can be tracked from an integration like HubSpot, Stripe, etc.",
    parameters: {
      type: "object",
      properties: {
        connection_id: { type: "string", description: "Data source connection ID" },
      },
      required: ["connection_id"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      return callPrecision("list_managed_queries", params);
    },
  });

  api.registerTool({
    name: "get_filter_options",
    description:
      "Get available filter options (dropdown values) for a specific field on a managed query. Use this when creating a metric with filters to know what values are available (e.g., deal stages, users, pipelines).",
    parameters: {
      type: "object",
      properties: {
        managed_query_id: { type: "string", description: "Managed query ID" },
        field: { type: "string", description: "Field name to get options for (e.g., 'status_id', 'user_id', 'pipeline_id')" },
        connection_id: { type: "string", description: "Data source connection ID" },
      },
      required: ["managed_query_id", "field", "connection_id"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      return callPrecision("get_filter_options", params);
    },
  });

  api.registerTool({
    name: "create_metric",
    description:
      "Create a new metric from a metric definition template. Use this to add a metric to the account's scorecard. Can include filter selections to narrow the data (e.g., only closed-won deals from a specific rep).",
    parameters: {
      type: "object",
      properties: {
        metric_definition_id: { type: "string", description: "Metric definition ID to create from" },
        team_id: { type: "string", description: "Team ID to add the metric to" },
        connection_id: { type: "string", description: "Data source connection ID (required for integration metrics)" },
        name: { type: "string", description: "Custom name for the metric (optional)" },
        filter_selections: {
          type: "object",
          description: "Filter configuration with root conditions (optional)",
        },
      },
      required: ["metric_definition_id", "team_id"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      return callPrecision("create_metric", params);
    },
  });

  api.registerTool({
    name: "get_underlying_data",
    description:
      "Get the individual records behind a metric value. Use this to drill into the details and understand what's driving a number (e.g., see the actual deals that make up 'Deals Won').",
    parameters: {
      type: "object",
      properties: {
        metric_id: { type: "string", description: "Metric ID" },
        date: { type: "string", description: "Date to get records for (YYYY-MM-DD)" },
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: { type: "number", description: "Records per page (default: 25, max: 100)" },
      },
      required: ["metric_id", "date"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      return callPrecision("get_underlying_data", params);
    },
  });
}

const BASE = process.env.PRECISION_API_URL || "https://operator-api.precision.co/api/v1/operator";
const TOKEN = process.env.PRECISION_API_TOKEN;

// Per-session JWT extracted from sessionKey via before_agent_start hook
let currentSessionToken: string | undefined;

function parseSessionKey(sessionKey: string | undefined): { accountId?: string; userId?: string; jwt?: string } {
  if (!sessionKey) return {};
  // Format: "<account_id>:<user_id>::<jwt>" (:: separates identity from token)
  const doubleColonIdx = sessionKey.indexOf("::");
  if (doubleColonIdx === -1) {
    // Legacy format: "<account_id>:<user_id>"
    const [accountId, userId] = sessionKey.split(":");
    return { accountId, userId };
  }
  const identityPart = sessionKey.substring(0, doubleColonIdx);
  const jwt = sessionKey.substring(doubleColonIdx + 2);
  const [accountId, userId] = identityPart.split(":");
  return { accountId, userId, jwt: jwt || undefined };
}

async function callPrecision(endpoint: string, body: Record<string, unknown>, token?: string) {
  const effectiveToken = token || currentSessionToken || TOKEN;
  if (!effectiveToken) {
    return { content: [{ type: "text" as const, text: "Error: No authentication token available (no session JWT or PRECISION_API_TOKEN)." }] };
  }
  try {
    const res = await fetch(`${BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${effectiveToken}`,
        "Content-Type": "application/json",
      },
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
  // Extract per-session JWT from sessionKey on each agent turn
  api.on("before_agent_start", (event: any, ctx: any) => {
    const sessionKey = ctx?.sessionKey;
    if (!sessionKey) return;
    const { jwt } = parseSessionKey(sessionKey);
    if (jwt) {
      currentSessionToken = jwt;
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

  // Zero-config metrics tools

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

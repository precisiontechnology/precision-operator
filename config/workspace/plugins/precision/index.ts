const BASE = process.env.PRECISION_API_URL || "https://operator-api.precision.co/api/v1/operator_tools";
const GATEWAY_TOKEN = process.env.PRECISION_GATEWAY_TOKEN;
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

type PrecisionRequestContext = {
  sessionKey?: string;
  accountId?: string;
  userId?: string;
};

function parseSessionKey(sessionKey: string): PrecisionRequestContext {
  const matches = sessionKey.match(UUID_PATTERN) || [];
  const canonicalSessionKey =
    matches.length >= 3
      ? `${matches[0]}:${matches[1]}:${matches[2]}`
      : sessionKey;

  return {
    sessionKey: canonicalSessionKey,
    accountId: matches[0],
    userId: matches[1],
  };
}

async function callPrecision(
  endpoint: string,
  body: Record<string, unknown>,
  requestContext: PrecisionRequestContext
) {
  if (!GATEWAY_TOKEN) {
    return { content: [{ type: "text" as const, text: "Error: PRECISION_GATEWAY_TOKEN not configured." }] };
  }

  const url = `${BASE}/${endpoint}`;
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${GATEWAY_TOKEN}`,
    "Content-Type": "application/json",
  };

  if (requestContext.userId) {
    headers["X-Operator-User-Id"] = requestContext.userId;
  }
  if (requestContext.accountId) {
    headers["X-Operator-Account-Id"] = requestContext.accountId;
  }
  if (requestContext.sessionKey) {
    headers["X-Operator-Session-Key"] = requestContext.sessionKey;
  }

  console.log(
    `[precision-plugin] ${endpoint} → ${url} ` +
      `(account: ${requestContext.accountId || "none"}, user: ${requestContext.userId || "none"})`
  );

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

function resolveRequestContext(ctx: any): PrecisionRequestContext {
  const sessionKey = typeof ctx?.sessionKey === "string" ? ctx.sessionKey.trim() : "";
  const agentAccountId =
    typeof ctx?.agentAccountId === "string" ? ctx.agentAccountId.trim() : "";

  if (!sessionKey) {
    return agentAccountId ? { accountId: agentAccountId } : {};
  }

  const requestContext = parseSessionKey(sessionKey);
  if (!requestContext.accountId && agentAccountId) {
    requestContext.accountId = agentAccountId;
  }
  return requestContext;
}

function registerPrecisionTool(
  api: any,
  endpoint: string,
  description: string,
  parameters: Record<string, unknown>
) {
  api.registerTool(
    (ctx: any) => {
      const requestContext = resolveRequestContext(ctx);

      return {
        name: endpoint,
        description,
        parameters,
        async execute(_id: string, params: Record<string, unknown>) {
          return callPrecision(endpoint, params, requestContext);
        },
      };
    },
    { name: endpoint }
  );
}

export default function (api: any) {
  registerPrecisionTool(
    api,
    "get_metrics_summary",
    "Search and retrieve business metrics by query. Use this FIRST whenever a user asks about any metric. Returns matching metrics with current values, trends, and status.",
    {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query (e.g. 'MRR', 'churn rate', 'revenue')" },
        diagnostic_mode: { type: "boolean", description: "Enable diagnostic mode for richer output" },
        limit: { type: "number", description: "Max number of results to return" },
      },
      required: ["query"],
    }
  );

  registerPrecisionTool(
    api,
    "get_metric_data",
    "Get time-series data for a specific metric. Use after get_metrics_summary to pull trends over a date range.",
    {
      type: "object",
      properties: {
        metric_id: { type: "string", description: "The metric ID from get_metrics_summary results" },
        days: { type: "number", description: "Number of days of data to return" },
        start_date: { type: "string", description: "Start date (YYYY-MM-DD)" },
        end_date: { type: "string", description: "End date (YYYY-MM-DD)" },
        time_expression: { type: "string", description: "Natural language time range (e.g. 'last 90 days')" },
      },
      required: ["metric_id"],
    }
  );

  registerPrecisionTool(
    api,
    "get_metric_by_name",
    "Look up a metric by its exact name. Use when you know the specific metric name.",
    {
      type: "object",
      properties: {
        metric_name: { type: "string", description: "Exact metric name" },
      },
      required: ["metric_name"],
    }
  );

  registerPrecisionTool(
    api,
    "explore_causality",
    "Trace upstream and downstream causal relationships for a metric. Use for 'why' questions — finds root causes (upstream) or downstream impact.",
    {
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
    }
  );

  registerPrecisionTool(
    api,
    "retrieve_kb_context",
    "Search the Precision knowledge base for playbooks, best practices, and growth strategies. Use for 'how to fix' questions after diagnosing with metrics and causality.",
    {
      type: "object",
      properties: {
        query: { type: "string", description: "What to search for (e.g. 'improve trial to paid conversion', 'reduce churn')" },
      },
      required: ["query"],
    }
  );

  // Zero-config metrics tools

  registerPrecisionTool(
    api,
    "list_data_source_connections",
    "List all connected data sources/integrations for this account. Use this FIRST when user asks about integrations, connected platforms, data sources, or what systems are syncing. Returns connection IDs needed for other zero-config tools. IMPORTANT: Always format results as a markdown table with columns: Integration | Status | Metrics | Last Sync | Health. Use ✅ for healthy, ⏳ for syncing, ⚠️ for errors.",
    {
      type: "object",
      properties: {},
      required: [],
    }
  );

  registerPrecisionTool(
    api,
    "list_managed_queries",
    "List available metric templates (managed queries) for a connected data source. Use this to discover what metrics CAN BE tracked from an integration like HubSpot, Stripe, etc.",
    {
      type: "object",
      properties: {
        connection_id: { type: "string", description: "Data source connection ID" },
      },
      required: ["connection_id"],
    }
  );

  registerPrecisionTool(
    api,
    "list_metrics_by_connection",
    "List metrics CURRENTLY BEING TRACKED from a specific integration. Use when user asks 'what am I tracking from HighLevel/Stripe/HubSpot?' Returns active metrics with current values, filters applied, and sync status.",
    {
      type: "object",
      properties: {
        connection_id: { type: "string", description: "Data source connection ID (from list_data_source_connections)" },
      },
      required: ["connection_id"],
    }
  );

  registerPrecisionTool(
    api,
    "get_filter_options",
    "Get available filter options (dropdown values) for a specific field on a managed query. Use this when creating a metric with filters to know what values are available (e.g., deal stages, users, pipelines).",
    {
      type: "object",
      properties: {
        managed_query_id: { type: "string", description: "Managed query ID" },
        field: { type: "string", description: "Field name to get options for (e.g., 'status_id', 'user_id', 'pipeline_id')" },
        connection_id: { type: "string", description: "Data source connection ID" },
      },
      required: ["managed_query_id", "field", "connection_id"],
    }
  );

  registerPrecisionTool(
    api,
    "list_teams",
    "List all teams for the account with their DRI (directly responsible individual), members, and current metrics. Use this FIRST when user mentions a team by name — resolves team name to team_id needed for create_metric.",
    {
      type: "object",
      properties: {
        name: { type: "string", description: "Filter by team name (case-insensitive partial match)" },
      },
      required: [],
    }
  );

  registerPrecisionTool(
    api,
    "create_metric",
    "Create a new metric from a metric definition template. Requires UUIDs from other tools: list_teams for team_id, list_managed_queries for metric_definition_id, list_data_source_connections for connection_id. For filters, use get_filter_options to see available values, then pass simple filters array. Multiple values in one field = OR, multiple fields = AND.",
    {
      type: "object",
      properties: {
        metric_definition_id: { type: "string", description: "Metric definition UUID (from list_managed_queries)" },
        team_id: { type: "string", description: "Team UUID (from list_teams)" },
        connection_id: { type: "string", description: "Data source connection ID (required for integration metrics)" },
        name: { type: "string", description: "Custom name for the metric (optional)" },
        filters: {
          type: "array",
          description: "STRICT FORMAT: [{\"field\": \"field_name\", \"values\": [\"val1\", \"val2\"]}]. Use 'values' (array), NOT 'value' (string). Do NOT use nested structures like {root: {conditions: []}}.",
          items: {
            type: "object",
            properties: {
              field: { type: "string", description: "Field name from get_filter_options" },
              values: { type: "array", items: { type: "string" }, description: "Array of values (even for single value)" },
            },
            required: ["field", "values"],
            additionalProperties: false,
          },
        },
      },
      required: ["metric_definition_id", "team_id"],
    }
  );

  registerPrecisionTool(
    api,
    "get_underlying_data",
    "Get the individual records behind a metric value. Use this to drill into the details and understand what's driving a number (e.g., see the actual deals that make up 'Deals Won').",
    {
      type: "object",
      properties: {
        metric_id: { type: "string", description: "Metric ID" },
        date: { type: "string", description: "Date to get records for (YYYY-MM-DD)" },
        page: { type: "number", description: "Page number (default: 1)" },
        per_page: { type: "number", description: "Records per page (default: 25, max: 100)" },
      },
      required: ["metric_id", "date"],
    }
  );
}

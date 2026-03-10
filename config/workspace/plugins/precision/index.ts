const BASE = process.env.PRECISION_API_URL || "https://operator.precision.co/api/v1/operator";
const TOKEN = process.env.PRECISION_API_TOKEN;

async function callPrecision(endpoint: string, body: Record<string, unknown>) {
  if (!TOKEN) {
    return { content: [{ type: "text" as const, text: "Error: PRECISION_API_TOKEN is not configured." }] };
  }
  try {
    const res = await fetch(`${BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
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
}

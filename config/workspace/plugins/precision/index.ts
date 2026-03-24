import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const BASE = process.env.PRECISION_API_URL || "https://operator-api.precision.co/api/v1/operator_tools";
const GATEWAY_TOKEN = process.env.PRECISION_GATEWAY_TOKEN;
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

// Browserless REST API
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;
const BROWSERLESS_URL = "https://production-sfo.browserless.io";

// R2 config
const R2_BUCKET = process.env.R2_BUCKET || "precision-media";
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "";
const ACCOUNT_ID = process.env.PRECISION_ACCOUNT_ID || "default";

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

async function uploadToR2(data: Buffer, filename: string): Promise<string> {
  if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    throw new Error("R2 credentials not configured");
  }
  const key = `claudia/${ACCOUNT_ID}/media/${Date.now()}-${filename}`;
  const s3 = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
  });
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET, Key: key, Body: data, ContentType: "image/png",
  }));
  return R2_PUBLIC_URL ? `${R2_PUBLIC_URL}/${key}` : `https://${R2_BUCKET}.${R2_ENDPOINT!.replace("https://","").replace("http://","")}/${key}`;
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

  // Screenshot tool — calls Browserless REST API directly, uploads to R2, returns URL
  api.registerTool({
    name: "take_screenshot",
    description:
      "Take a screenshot of any webpage. Returns a public image URL. Use when user asks to screenshot, capture, or show them any webpage. Always include the returned URL as a markdown image in your response: ![Screenshot](url)",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to screenshot" },
        full_page: { type: "boolean", description: "Capture the full scrollable page (default: false, viewport only)" },
        selector: { type: "string", description: "CSS selector to screenshot a specific element (e.g. '#hero', '.pricing-table')" },
        width: { type: "number", description: "Viewport width in pixels (default: 1920)" },
        height: { type: "number", description: "Viewport height in pixels (default: 1080)" },
        wait_for: { type: "number", description: "Milliseconds to wait after page load before capturing (default: 3000)" },
      },
      required: ["url"],
    },
    async execute(_id: string, params: Record<string, unknown>) {
      if (!BROWSERLESS_TOKEN) {
        return { content: [{ type: "text" as const, text: "Error: BROWSERLESS_TOKEN is not configured." }] };
      }

      const targetUrl = params.url as string;
      const fullPage = (params.full_page as boolean) || false;
      const selector = params.selector as string | undefined;
      const width = (params.width as number) || 1920;
      const height = (params.height as number) || 1080;
      const waitFor = (params.wait_for as number) || 3000;

      try {
        const body: Record<string, unknown> = {
          url: targetUrl,
          options: {
            fullPage,
            type: "png",
          },
          viewport: { width, height },
          waitForTimeout: waitFor,
          gotoOptions: { waitUntil: "networkidle2", timeout: 30000 },
        };

        if (selector) {
          body.selector = selector;
        }

        const res = await fetch(`${BROWSERLESS_URL}/screenshot?token=${BROWSERLESS_TOKEN}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const errText = await res.text();
          return { content: [{ type: "text" as const, text: `Screenshot failed (${res.status}): ${errText}` }] };
        }

        const pngBuffer = Buffer.from(await res.arrayBuffer());
        const filename = `screenshot-${Date.now()}.png`;

        const publicUrl = await uploadToR2(pngBuffer, filename);

        return {
          content: [{
            type: "text" as const,
            text: `Screenshot captured successfully.\n\nImage URL: ${publicUrl}\n\nInclude this in your response:\n![Screenshot](${publicUrl})`,
          }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Screenshot failed: ${message}` }] };
      }
    },
  });

  registerPrecisionTool(
    api,
    "list_available_data_sources",
    "List available data source integrations with connection status. Each source includes a pre-built `integration_block`. IMPORTANT: Do NOT paste integration_blocks in your response unless the user has named a SPECIFIC source to connect. If the user asks what's available, summarize the list as text and ask which one they want. Only paste ONE integration_block at a time, only after the user chooses.",
    {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional category filter (e.g., 'sales_crm', 'paid_ads', 'finance')" },
      },
      required: [],
    }
  );
}

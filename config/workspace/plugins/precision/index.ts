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
    "Create a new metric. Supports three types via data_type: 'integration' (from a data source template), 'direct_entry' (manual metric the user updates themselves), 'calculated' (auto-computed from a formula referencing other metrics). For integration: requires metric_definition_id + connection_id. For direct_entry: requires name, unit, direction, measurement_frequency. For calculated: requires name + formula_expression (e.g. \'MQLs + SQLs\'). Always pass team_id.",
    {
      type: "object",
      properties: {
        data_type: { type: "string", enum: ["integration", "direct_entry", "calculated"], description: "Metric type. Default: \'integration\'. Use \'direct_entry\' for manual metrics the user updates, \'calculated\' for formula-based metrics." },
        team_id: { type: "string", description: "Team UUID (from list_teams)" },
        name: { type: "string", description: "Metric name. Required for direct_entry and calculated. Optional for integration (defaults to definition name)." },
        metric_definition_id: { type: "string", description: "Metric definition UUID from list_managed_queries. Required for integration type only." },
        connection_id: { type: "string", description: "Data source connection ID. Required for integration type only." },
        unit: { type: "string", enum: ["integer", "decimal", "percentage", "currency", "minutes", "hours", "days"], description: "Unit for the metric. Required for direct_entry and calculated." },
        direction: { type: "string", enum: ["more_is_better", "less_is_better"], description: "Whether higher values are good. Required for direct_entry and calculated." },
        measurement_frequency: { type: "string", enum: ["daily", "weekly", "monthly"], description: "How often the metric is measured. Required for direct_entry." },
        aggregation_type: { type: "string", enum: ["sum", "latest", "average"], description: "How to aggregate values. Default: sum." },
        pacing_type: { type: "string", enum: ["linear_growth", "direct_comparison"], description: "Pacing method. Default: linear_growth." },
        formula_expression: { type: "string", description: "Natural language formula for calculated metrics (e.g. \'MQLs + SQLs\', \'(Demos Booked / MQLs) * 100\'). Tool resolves metric names to UUIDs automatically." },
        filters: {
          type: "array",
          description: "Integration metrics only. STRICT FORMAT: [{\"field\": \"field_name\", \"values\": [\"val1\", \"val2\"]}]. Use \'values\' (array), NOT \'value\' (string).",
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
      required: ["team_id"],
    }
  );;

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

  // New Operator Tools (PSA-574)

  registerPrecisionTool(
    api,
    "update_metric",
    "Update an existing metric's properties. Supports partial updates — only fields passed are changed.",
    {
      type: "object",
      properties: {
        metric_id: { type: "string", description: "ID of the metric to update" },
        name: { type: "string", description: "New name" },
        description: { type: "string", description: "New description" },
        unit: { type: "string", enum: ["integer", "decimal", "percentage", "currency", "minutes", "hours", "days"] },
        direction: { type: "string", enum: ["more_is_better", "less_is_better"] },
        dri_id: { type: "string", description: "Account user ID of the DRI" },
        measurement_frequency: { type: "string", enum: ["daily", "weekly", "monthly"] },
        aggregation_type: { type: "string", enum: ["sum", "latest", "average"] },
      },
      required: ["metric_id"],
    }
  );

  registerPrecisionTool(
    api,
    "archive_metric",
    "Archive a metric (soft delete). Returns error if metric is in active scorecards.",
    {
      type: "object",
      properties: { metric_id: { type: "string" } },
      required: ["metric_id"],
    }
  );

  registerPrecisionTool(
    api,
    "unarchive_metric",
    "Unarchive a previously archived metric.",
    {
      type: "object",
      properties: { metric_id: { type: "string" } },
      required: ["metric_id"],
    }
  );

  registerPrecisionTool(
    api,
    "update_metric_value",
    "Manually set or update a metric value. Supports daily (single day), weekly, or monthly granularity. " +
      "When weekly/monthly, distributes the value across all days in the period (same as scorecard UI). " +
      "IMPORTANT: When a user provides a value for a month or week (e.g. 'CAC for March was $412'), " +
      "confirm with them before calling with monthly/weekly granularity: " +
      "'Got it — want me to backfill that across all of [month/week]?' Only proceed after they confirm.",
    {
      type: "object",
      properties: {
        metric_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD. For monthly use first of month (2025-03-01). For weekly use the Monday." },
        value: { type: "number" },
        granularity: { type: "string", enum: ["daily", "weekly", "monthly"], description: "Defaults to daily. Use weekly/monthly to distribute across the period." },
      },
      required: ["metric_id", "date", "value"],
    }
  );

  registerPrecisionTool(
    api,
    "delete_metric_value",
    "Clear a specific date's value on a direct_entry metric.",
    {
      type: "object",
      properties: {
        metric_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD" },
      },
      required: ["metric_id", "date"],
    }
  );

  registerPrecisionTool(
    api,
    "list_scorecards",
    "List all scorecards for the account.",
    { type: "object", properties: {} }
  );

  registerPrecisionTool(
    api,
    "get_scorecard",
    "Get full scorecard detail: sections, metrics, positions.",
    {
      type: "object",
      properties: { scorecard_id: { type: "string" } },
      required: ["scorecard_id"],
    }
  );

  registerPrecisionTool(
    api,
    "create_scorecard",
    "Create a new scorecard.",
    {
      type: "object",
      properties: {
        name: { type: "string" },
        team_id: { type: "string" },
        allowed_granularities: { type: "array", items: { type: "string" } },
        default: { type: "boolean" },
      },
      required: ["name"],
    }
  );

  registerPrecisionTool(
    api,
    "update_scorecard",
    "Update scorecard properties.",
    {
      type: "object",
      properties: {
        scorecard_id: { type: "string" },
        name: { type: "string" },
        team_id: { type: "string" },
        default: { type: "boolean" },
      },
      required: ["scorecard_id"],
    }
  );

  registerPrecisionTool(
    api,
    "delete_scorecard",
    "Delete a scorecard. Blocks if it is the only/default scorecard.",
    {
      type: "object",
      properties: { scorecard_id: { type: "string" } },
      required: ["scorecard_id"],
    }
  );

  registerPrecisionTool(
    api,
    "create_scorecard_section",
    "Add a named section to a scorecard.",
    {
      type: "object",
      properties: {
        scorecard_id: { type: "string" },
        name: { type: "string" },
        position: { type: "number" },
      },
      required: ["scorecard_id", "name"],
    }
  );

  registerPrecisionTool(
    api,
    "update_scorecard_section",
    "Rename a scorecard section.",
    {
      type: "object",
      properties: {
        section_id: { type: "string" },
        name: { type: "string" },
      },
      required: ["section_id", "name"],
    }
  );

  registerPrecisionTool(
    api,
    "delete_scorecard_section",
    "Remove a section. Requires force: true if metrics are present.",
    {
      type: "object",
      properties: {
        section_id: { type: "string" },
        force: { type: "boolean" },
      },
      required: ["section_id"],
    }
  );

  registerPrecisionTool(
    api,
    "reorder_scorecard_section",
    "Change a section's position.",
    {
      type: "object",
      properties: {
        section_id: { type: "string" },
        position: { type: "number" },
      },
      required: ["section_id", "position"],
    }
  );

  registerPrecisionTool(
    api,
    "add_metric_to_scorecard",
    "Add a metric to a scorecard section.",
    {
      type: "object",
      properties: {
        section_id: { type: "string" },
        metric_id: { type: "string" },
      },
      required: ["section_id", "metric_id"],
    }
  );

  registerPrecisionTool(
    api,
    "remove_metric_from_scorecard",
    "Remove a metric from a scorecard.",
    {
      type: "object",
      properties: {
        scorecard_id: { type: "string" },
        metric_id: { type: "string" },
      },
      required: ["scorecard_id", "metric_id"],
    }
  );

  registerPrecisionTool(
    api,
    "reorder_scorecard_metric",
    "Move/reorder metric within or between sections.",
    {
      type: "object",
      properties: {
        scorecard_metric_id: { type: "string" },
        section_id: { type: "string" },
        position: { type: "number" },
      },
      required: ["scorecard_metric_id", "section_id", "position"],
    }
  );

  registerPrecisionTool(
    api,
    "create_metric_note",
    "Add an annotation to a metric cell. " +
      "cell_type determines which cell the note appears on: " +
      "'metric_value' = a specific daily value cell, " +
      "'aggregation' = a monthly/weekly total cell (e.g. the March total column), " +
      "'goal' = a goal cell. " +
      "IMPORTANT: When the user's request is ambiguous (e.g. 'leave a note on March'), " +
      "ask which cell they mean: 'Want me to put that on the March total, or a specific day?'",
    {
      type: "object",
      properties: {
        metric_id: { type: "string" },
        date: { type: "string", description: "YYYY-MM-DD. For monthly totals use first of month (2026-03-01)." },
        content: { type: "string" },
        cell_type: { type: "string", enum: ["metric_value", "aggregation", "goal"], description: "metric_value = daily cell, aggregation = monthly/weekly total, goal = goal cell. Defaults to metric_value." },
      },
      required: ["metric_id", "date", "content"],
    }
  );

  registerPrecisionTool(
    api,
    "update_metric_note",
    "Edit an existing note.",
    {
      type: "object",
      properties: {
        note_id: { type: "string" },
        content: { type: "string" },
      },
      required: ["note_id", "content"],
    }
  );

  registerPrecisionTool(
    api,
    "delete_metric_note",
    "Delete a note.",
    {
      type: "object",
      properties: { note_id: { type: "string" } },
      required: ["note_id"],
    }
  );

  registerPrecisionTool(
    api,
    "create_team",
    "Create a team. Auto-creates default scorecard.",
    {
      type: "object",
      properties: {
        name: { type: "string" },
        dri_account_user_id: { type: "string" },
      },
      required: ["name", "dri_account_user_id"],
    }
  );

  registerPrecisionTool(
    api,
    "update_team",
    "Rename team or change DRI.",
    {
      type: "object",
      properties: {
        team_id: { type: "string" },
        name: { type: "string" },
        dri_account_user_id: { type: "string" },
      },
      required: ["team_id"],
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

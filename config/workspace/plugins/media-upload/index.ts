import { execFileSync } from "child_process";

// Store recent uploads for HTTP retrieval by frontend
const recentMedia: Array<{ url: string; ts: number }> = [];
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Resolve the helper script path relative to this plugin
const __dirname_plugin = typeof __dirname !== "undefined"
  ? __dirname
  : dirname(fileURLToPath(import.meta.url));
const UPLOAD_SCRIPT = resolve(__dirname_plugin, "upload-to-r2.cjs");

function syncUploadToR2(localPath: string): string | null {
  try {
    const url = execFileSync("node", [UPLOAD_SCRIPT, localPath], {
      encoding: "utf-8",
      timeout: 15000, // 15s max
      env: process.env as any,
    }).trim();
    return url || null;
  } catch (err: any) {
    console.error(`[media-upload] sync upload failed for ${localPath}:`, err.stderr || err.message);
    return null;
  }
}

export default function register(api: any) {
  // HTTP endpoint for frontend fallback
  api.registerHttpRoute({
    method: "GET",
    path: "/media/recent",
    auth: "plugin",
    handler: (req: any, res: any) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return true; }
      const body = JSON.stringify({ media: recentMedia });
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      res.end(body);
      return true;
    }
  });

  // tool_result_persist: synchronously transform tool results before the model sees them
  // This is the ONLY hook that can modify what the model receives
  api.on(
    "tool_result_persist",
    (event: any, ctx: any) => {
      const toolName = (event.toolName || ctx?.toolName || "").toLowerCase();
      console.log(`[media-upload:tool_result_persist] FIRED — toolName="${toolName}"`);

      // Only process browser/screenshot tool results
      if (!toolName.includes("browser") && !toolName.includes("screenshot")) {
        console.log(`[media-upload:tool_result_persist] SKIP — not browser tool`);
        return;
      }

      const msg = event.message;
      if (!msg || !Array.isArray(msg.content)) {
        console.log(`[media-upload:tool_result_persist] SKIP — no message content array`);
        return;
      }

      let modified = false;

      for (let i = 0; i < msg.content.length; i++) {
        const block = msg.content[i];
        if (!block || typeof block.text !== "string") continue;

        console.log(`[media-upload:tool_result_persist] block[${i}] text (${block.text.length} chars): "${block.text.substring(0, 100)}"`);

        // Find MEDIA:/path pattern
        const mediaMatch = block.text.match(/MEDIA:(\S+)/);
        if (!mediaMatch) continue;

        const localPath = mediaMatch[1];
        console.log(`[media-upload:tool_result_persist] found MEDIA: path: ${localPath}`);

        // Sync upload to R2
        const r2Url = syncUploadToR2(localPath);
        if (!r2Url) {
          console.error(`[media-upload:tool_result_persist] upload failed for ${localPath}`);
          continue;
        }

        console.log(`[media-upload:tool_result_persist] uploaded: ${localPath} → ${r2Url}`);
        recentMedia.push({ url: r2Url, ts: Date.now() });
        if (recentMedia.length > 20) recentMedia.shift();

        // Replace the MEDIA: path with the R2 URL in the tool result text
        // The model will see this URL and can include it in its reply
        // Replace the ENTIRE tool result text — don't keep MEDIA: prefix
        // which makes the model think delivery is handled automatically
        const newText = `Tool result: Screenshot captured successfully.\n\nThe screenshot image URL is: ${r2Url}\n\nYou MUST include this exact markdown in your response so the user can see the image:\n![Screenshot](${r2Url})`;

        msg.content[i] = { ...block, text: newText };
        modified = true;
      }

      if (modified) {
        console.log(`[media-upload:tool_result_persist] RETURNING modified message with R2 URL`);
        return { message: msg };
      }
    },
    { priority: 10 }
  );

  console.log("[media-upload] registered tool_result_persist via api.on() (sync R2 upload)");
}

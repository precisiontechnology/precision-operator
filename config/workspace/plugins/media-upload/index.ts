import { execFileSync } from "child_process";
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

        // Replace the MEDIA: path with the R2 URL in the tool result text
        // The model will see this URL and can include it in its reply
        const newText = block.text.replace(
          `MEDIA:${localPath}`,
          `Screenshot uploaded and available at: ${r2Url}\n\nYou MUST include this image in your reply to the user using markdown: ![Screenshot](${r2Url})`
        );

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

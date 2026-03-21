import { uploadToR2FromBuffer, uploadToR2 } from "./r2-client.js";
import { scanForLocalPaths, filterExistingFiles } from "./path-scanner.js";

const recentMedia: Array<{ url: string; toolCallId: string; ts: number }> = [];
const MAX_RECENT = 50;

function addMedia(url: string, toolCallId: string) {
  recentMedia.push({ url, toolCallId, ts: Date.now() });
  while (recentMedia.length > MAX_RECENT) recentMedia.shift();
}

export default function register(api: any) {
  // HTTP endpoint — single route, plugin auth (handles CORS itself)
  api.registerHttpRoute({
    method: "GET",
    path: "/media/recent",
    auth: "plugin",  // plugin auth so we handle CORS + auth ourselves
    handler: (req: any, res: any) => {
      // CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

      // Handle preflight
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return true;
      }

      const results = recentMedia;
      const body = JSON.stringify({ media: results.map(m => ({ url: m.url, toolCallId: m.toolCallId, ts: m.ts })) });
      res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      res.end(body);
      console.log(`[media-upload] GET /media/recent → ${results.length} items`);
      return true;
    }
  });

  // after_tool_call — upload to R2 and store URL
  api.on(
    "after_tool_call",
    async (event: any, ctx: any) => {
      const name = (event.toolName || ctx?.toolName || "").toLowerCase();
      if (!name.includes("browser") && !name.includes("screenshot")) return;

      const result = event.result as any;
      if (!result) return;

      const content = result.content || result;
      if (!Array.isArray(content)) return;

      const toolCallId = event.toolCallId || ctx?.toolCallId || "";

      for (const block of content) {
        if (!block) continue;

        if (block.type === "image" && block.source?.type === "base64" && block.source?.data) {
          const mediaType = block.source.media_type || "image/png";
          const ext = mediaType.split("/")[1] || "png";
          const filename = `screenshot-${Date.now()}.${ext}`;
          const buffer = Buffer.from(block.source.data, "base64");
          const url = await uploadToR2FromBuffer(buffer, filename, mediaType);
          if (url) {
            addMedia(url, toolCallId);
            console.log(`[media-upload] screenshot uploaded: ${url}`);
          }
        }

        if (typeof block.text === "string") {
          const mediaMatch = block.text.match(/MEDIA:(\S+)/);
          if (mediaMatch) {
            const url = await uploadToR2(mediaMatch[1]);
            if (url) {
              addMedia(url, toolCallId);
              console.log(`[media-upload] MEDIA: path uploaded: ${mediaMatch[1]} → ${url}`);
            }
          }

          const matches = scanForLocalPaths(block.text);
          if (matches.length > 0) {
            const existing = await filterExistingFiles(matches);
            for (const match of existing) {
              const url = await uploadToR2(match.path);
              if (url) {
                addMedia(url, toolCallId);
                console.log(`[media-upload] file uploaded: ${match.path} → ${url}`);
              }
            }
          }
        }
      }
    },
    { priority: 5 }
  );

  console.log("[media-upload] registered GET /media/recent + after_tool_call hooks");
}

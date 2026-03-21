import { uploadToR2FromBuffer, uploadToR2 } from "./r2-client.js";
import { scanForLocalPaths, filterExistingFiles } from "./path-scanner.js";

// Store recent media URLs — keyed by session+run for retrieval
const recentMedia: Array<{ url: string; toolCallId: string; ts: number }> = [];
const MAX_RECENT = 50;

function addMedia(url: string, toolCallId: string) {
  recentMedia.push({ url, toolCallId, ts: Date.now() });
  // Prune old entries
  while (recentMedia.length > MAX_RECENT) recentMedia.shift();
}

export default function register(api: any) {
  // ============================================================
  // HTTP ROUTE: GET /media/recent — frontend fetches after tool completion
  // ============================================================
  api.registerHttpRoute({
    method: "GET",
    path: "/media/recent",
    auth: "gateway",
    handler: (req: any, res: any) => {
      const since = Number(req.query?.since || 0);
      const toolCallId = req.query?.toolCallId;

      let results = recentMedia;
      if (since > 0) results = results.filter(m => m.ts > since);
      if (toolCallId) results = results.filter(m => m.toolCallId === toolCallId);

      res.json({ media: results.map(m => ({ url: m.url, toolCallId: m.toolCallId, ts: m.ts })) });
      return true;
    }
  });

  // ============================================================
  // HOOK: after_tool_call — upload to R2, store URL for HTTP retrieval
  // ============================================================
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

        // Base64 image blocks
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

        // Text blocks with MEDIA: paths or local file paths
        if (typeof block.text === "string") {
          // Handle MEDIA: prefix
          const mediaMatch = block.text.match(/MEDIA:(\S+)/);
          if (mediaMatch) {
            const localPath = mediaMatch[1];
            const url = await uploadToR2(localPath);
            if (url) {
              addMedia(url, toolCallId);
              console.log(`[media-upload] MEDIA: path uploaded: ${localPath} → ${url}`);
            }
          }

          // Also scan for regular file paths
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

  // ============================================================
  // HOOK: message_sending — fallback for Telegram/channel delivery
  // ============================================================
  api.on(
    "message_sending",
    async (event: any) => {
      const { content } = event;
      if (!content) return;

      // Get URLs from last 30 seconds
      const cutoff = Date.now() - 30000;
      const recent = recentMedia.filter(m => m.ts > cutoff);
      if (recent.length === 0) return;

      const missingUrls = recent.map(m => m.url).filter(url => !content.includes(url));
      if (missingUrls.length === 0) return;

      const imageMarkdown = missingUrls.map(url => `\n\n![Screenshot](${url})`).join("");
      console.log(`[media-upload:message_sending] appended ${missingUrls.length} URL(s)`);
      return { content: content + imageMarkdown };
    },
    { priority: 10 }
  );

  console.log("[media-upload] registered HTTP /media/recent + after_tool_call + message_sending hooks");
}

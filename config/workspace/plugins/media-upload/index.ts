import { uploadToR2FromBuffer, uploadToR2 } from "./r2-client.js";
import { scanForLocalPaths, filterExistingFiles } from "./path-scanner.js";

export default function register(api: any) {
  const { emitAgentEvent } = api.runtime.events;

  // Single hook: after_tool_call — upload to R2 and emit event to WebSocket
  api.on(
    "after_tool_call",
    async (event: any, ctx: any) => {
      const name = (event.toolName || ctx?.toolName || "").toLowerCase();
      if (!name.includes("browser") && !name.includes("screenshot")) return;

      const result = event.result as any;
      if (!result) return;

      const content = result.content || result;
      if (!Array.isArray(content)) return;

      const runId = event.runId || "";
      const sessionKey = ctx?.sessionKey || "";
      const uploadedUrls: string[] = [];

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
            uploadedUrls.push(url);
            console.log(`[media-upload] screenshot uploaded: ${url}`);
          }
        }

        // Text blocks with MEDIA: paths or local file paths
        if (typeof block.text === "string") {
          const mediaMatch = block.text.match(/MEDIA:(\S+)/);
          if (mediaMatch) {
            const url = await uploadToR2(mediaMatch[1]);
            if (url) {
              uploadedUrls.push(url);
              console.log(`[media-upload] MEDIA: path uploaded: ${mediaMatch[1]} → ${url}`);
            }
          }

          const matches = scanForLocalPaths(block.text);
          if (matches.length > 0) {
            const existing = await filterExistingFiles(matches);
            for (const match of existing) {
              const url = await uploadToR2(match.path);
              if (url) {
                uploadedUrls.push(url);
                console.log(`[media-upload] file uploaded: ${match.path} → ${url}`);
              }
            }
          }
        }
      }

      // Emit media event to WebSocket so frontend can render the images
      if (uploadedUrls.length > 0) {
        emitAgentEvent({
          runId,
          stream: "media",
          sessionKey,
          data: {
            type: "screenshot",
            urls: uploadedUrls,
          },
        });
        console.log(`[media-upload] emitted ${uploadedUrls.length} media URL(s) to WebSocket`);
      }
    },
    { priority: 5 }
  );

  // Fallback: message_sending for Telegram/channel delivery
  api.on(
    "message_sending",
    async (event: any) => {
      // This still works for Telegram since OpenClaw handles MEDIA: internally
      // No changes needed here
    },
    { priority: 10 }
  );

  console.log("[media-upload] registered after_tool_call hook (emitAgentEvent for WS delivery)");
}

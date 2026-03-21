import { uploadToR2FromBuffer, uploadToR2 } from "./r2-client.js";
import { scanForLocalPaths, filterExistingFiles } from "./path-scanner.js";

export default function register(api: any) {
  // Hook 1: after_tool_call — intercept browser screenshot results
  api.on(
    "after_tool_call",
    async (event: { toolName: string; params: Record<string, unknown>; result?: unknown }, ctx: any) => {
      // Only intercept browser/screenshot tool calls
      const name = event.toolName?.toLowerCase() || "";
      if (!name.includes("browser") && !name.includes("screenshot")) return;

      const result = event.result as any;
      if (!result) return;

      // Look for image data in tool result content blocks
      const content = result.content || result;
      if (!Array.isArray(content)) return;

      for (let i = 0; i < content.length; i++) {
        const block = content[i];
        if (!block) continue;

        // Handle base64 image blocks
        if (block.type === "image" && block.source?.type === "base64" && block.source?.data) {
          const mediaType = block.source.media_type || "image/png";
          const ext = mediaType.split("/")[1] || "png";
          const filename = `screenshot-${Date.now()}.${ext}`;
          const buffer = Buffer.from(block.source.data, "base64");
          
          const url = await uploadToR2FromBuffer(buffer, filename, mediaType);
          if (url) {
            // Replace the base64 block with a text block containing the URL
            content[i] = { type: "text", text: `![Screenshot](${url})` };
            console.log(`[media-upload] screenshot uploaded: ${url}`);
          }
        }

        // Handle local file path references in text blocks
        if (block.type === "text" && typeof block.text === "string") {
          const matches = scanForLocalPaths(block.text);
          if (matches.length > 0) {
            const existing = await filterExistingFiles(matches);
            let text = block.text;
            for (const match of existing.reverse()) {
              const url = await uploadToR2(match.path);
              if (url) {
                text = text.slice(0, match.start) + url + text.slice(match.end);
                console.log(`[media-upload] file uploaded: ${match.path} → ${url}`);
              }
            }
            content[i] = { type: "text", text };
          }
        }
      }
    },
    { priority: 5 }
  );

  // Hook 2: message_sending — catch any remaining local paths before delivery
  api.on(
    "message_sending",
    async (event: { to: string; content: string; metadata?: Record<string, unknown> }) => {
      const { content } = event;
      if (!content) return;

      const matches = scanForLocalPaths(content);
      if (matches.length === 0) return;

      const existing = await filterExistingFiles(matches);
      if (existing.length === 0) return;

      let rewritten = content;
      for (const match of [...existing].sort((a, b) => b.start - a.start)) {
        const url = await uploadToR2(match.path);
        if (url) {
          rewritten = rewritten.slice(0, match.start) + url + rewritten.slice(match.end);
          console.log(`[media-upload] message path uploaded: ${match.path} → ${url}`);
        }
      }

      // Safety: strip remaining local paths
      rewritten = rewritten.replace(
        /(?:\/(?:tmp|home|var|Users|root)\/[^\s"'<>)}\]]+)/g,
        "[file reference removed]"
      );

      if (rewritten !== content) {
        return { content: rewritten };
      }
    },
    { priority: 10 }
  );

  console.log("[media-upload] registered after_tool_call + message_sending hooks");
}

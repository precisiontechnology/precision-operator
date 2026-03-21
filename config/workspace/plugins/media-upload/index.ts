import { uploadToR2FromBuffer, uploadToR2 } from "./r2-client.js";
import { scanForLocalPaths, filterExistingFiles } from "./path-scanner.js";

// Track uploaded URLs per run so we can inject them into the tool result
// The model sees the modified tool result and can reference the URL in its reply
const pendingUrls: string[] = [];

export default function register(api: any) {
  // Hook 1: after_tool_call — intercept browser screenshot results, upload to R2,
  // and replace base64 blocks with URL references the model can use
  api.on(
    "after_tool_call",
    async (event: { toolName: string; params: Record<string, unknown>; result?: unknown }, ctx: any) => {
      const name = event.toolName?.toLowerCase() || "";
      if (!name.includes("browser") && !name.includes("screenshot")) return;

      const result = event.result as any;
      if (!result) return;

      const content = result.content || result;
      if (!Array.isArray(content)) return;

      for (let i = 0; i < content.length; i++) {
        const block = content[i];
        if (!block) continue;

        // Handle base64 image blocks — upload and replace with URL text
        if (block.type === "image" && block.source?.type === "base64" && block.source?.data) {
          const mediaType = block.source.media_type || "image/png";
          const ext = mediaType.split("/")[1] || "png";
          const filename = `screenshot-${Date.now()}.${ext}`;
          const buffer = Buffer.from(block.source.data, "base64");

          const url = await uploadToR2FromBuffer(buffer, filename, mediaType);
          if (url) {
            // Replace the image block with a text block containing the public URL
            // This is what the model sees — it should include this URL in its reply
            content[i] = {
              type: "text",
              text: `[Screenshot uploaded to: ${url}]\n\nIMPORTANT: Include this image in your reply using markdown: ![Screenshot](${url})`
            };
            pendingUrls.push(url);
            console.log(`[media-upload] screenshot uploaded: ${url}`);
          }
        }

        // Handle local file paths in text blocks
        if (block.type === "text" && typeof block.text === "string") {
          const matches = scanForLocalPaths(block.text);
          if (matches.length > 0) {
            const existing = await filterExistingFiles(matches);
            let text = block.text;
            for (const match of existing.reverse()) {
              const url = await uploadToR2(match.path);
              if (url) {
                text = text.slice(0, match.start) + url + text.slice(match.end);
                pendingUrls.push(url);
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

  // Hook 2: message_sending — if the model didn't include the URL, append it
  api.on(
    "message_sending",
    async (event: { to: string; content: string; metadata?: Record<string, unknown> }) => {
      const { content } = event;
      if (!content) return;

      // Check if any pending URLs are missing from the outbound content
      const missingUrls = pendingUrls.filter(url => !content.includes(url));

      // Also scan for local file paths as a safety net
      const matches = scanForLocalPaths(content);
      const existing = matches.length > 0 ? await filterExistingFiles(matches) : [];

      let rewritten = content;

      // Upload any remaining local file paths
      for (const match of [...existing].sort((a, b) => b.start - a.start)) {
        const url = await uploadToR2(match.path);
        if (url) {
          rewritten = rewritten.slice(0, match.start) + url + rewritten.slice(match.end);
          console.log(`[media-upload] message path uploaded: ${match.path} → ${url}`);
        }
      }

      // Strip remaining local paths
      rewritten = rewritten.replace(
        /(?:\/(?:tmp|home|var|Users|root)\/[^\s"'<>)}\]]+)/g,
        "[file reference removed]"
      );

      // Append any missing screenshot URLs
      if (missingUrls.length > 0) {
        const imageMarkdown = missingUrls.map(url => `\n\n![Screenshot](${url})`).join("");
        rewritten += imageMarkdown;
        console.log(`[media-upload] appended ${missingUrls.length} missing screenshot URL(s) to message`);
      }

      // Clear pending URLs after delivery
      pendingUrls.length = 0;

      if (rewritten !== content) {
        return { content: rewritten };
      }
    },
    { priority: 10 }
  );

  console.log("[media-upload] registered after_tool_call + message_sending hooks");
}

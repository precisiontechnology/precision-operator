import { uploadToR2FromBuffer, uploadToR2 } from "./r2-client.js";
import { scanForLocalPaths, filterExistingFiles } from "./path-scanner.js";

// Map local paths to R2 URLs — populated by after_tool_call, consumed by tool_result_persist
const uploadedPathMap = new Map<string, string>();
// Track pending URLs for message_sending fallback
const pendingUrls: string[] = [];

export default function register(api: any) {
  // STEP 1: after_tool_call — upload files to R2 and build the path→URL map
  api.on(
    "after_tool_call",
    async (event: { toolName: string; result?: unknown }) => {
      const name = (event.toolName || "").toLowerCase();
      if (!name.includes("browser") && !name.includes("screenshot")) return;

      const result = event.result as any;
      if (!result) return;

      const content = result.content || result;
      if (!Array.isArray(content)) return;

      for (const block of content) {
        if (!block) continue;

        if (block.type === "image" && block.source?.type === "base64" && block.source?.data) {
          const mediaType = block.source.media_type || "image/png";
          const ext = mediaType.split("/")[1] || "png";
          const filename = `screenshot-${Date.now()}.${ext}`;
          const buffer = Buffer.from(block.source.data, "base64");
          const url = await uploadToR2FromBuffer(buffer, filename, mediaType);
          if (url) {
            pendingUrls.push(url);
            console.log(`[media-upload] screenshot uploaded: ${url}`);
          }
        }

        if ((block.type === "text" || typeof block.text === "string") && typeof block.text === "string") {
          const matches = scanForLocalPaths(block.text);
          if (matches.length === 0) continue;
          const existing = await filterExistingFiles(matches);
          for (const match of existing) {
            const url = await uploadToR2(match.path);
            if (url) {
              uploadedPathMap.set(match.path, url);
              pendingUrls.push(url);
              console.log(`[media-upload] file uploaded: ${match.path} → ${url}`);
            }
          }
        }
      }
    },
    { priority: 5 }
  );

  // STEP 2: tool_result_persist — rewrite local paths to R2 URLs in the tool result
  // This is SYNC and fires AFTER after_tool_call, so the map should be populated
  api.registerHook(
    "tool_result_persist",
    (event: { toolName?: string; message: any }) => {
      if (uploadedPathMap.size === 0) return;

      const name = (event.toolName || "").toLowerCase();
      if (!name.includes("browser") && !name.includes("screenshot")) return;

      const msg = event.message;
      if (!msg || !Array.isArray(msg.content)) return;

      let modified = false;
      for (let i = 0; i < msg.content.length; i++) {
        const block = msg.content[i];
        if (!block || typeof block.text !== "string") continue;

        let text = block.text;
        for (const [localPath, r2Url] of uploadedPathMap) {
          if (text.includes(localPath)) {
            text = text.replace(localPath, r2Url);
            modified = true;
          }
          // Also check basename match
          const basename = localPath.split("/").pop();
          if (basename && text.includes(basename)) {
            text = text.replaceAll(basename, r2Url);
            modified = true;
          }
        }

        if (modified) {
          // Append instruction for the model
          text += `\n\nINCLUDE THIS IMAGE IN YOUR REPLY: ![Screenshot](${[...uploadedPathMap.values()].pop()})`;
          msg.content[i] = { ...block, text };
        }
      }

      if (modified) {
        console.log(`[media-upload] tool_result_persist: rewrote paths to R2 URLs`);
        uploadedPathMap.clear();
        return { message: msg };
      }
    },
    { name: "media-upload.tool-result-persist", description: "Rewrite screenshot paths to R2 URLs" }
  );

  // STEP 3: message_sending — fallback for Telegram/channels
  api.on(
    "message_sending",
    async (event: { to: string; content: string }) => {
      const { content } = event;
      if (!content || pendingUrls.length === 0) return;

      const missingUrls = pendingUrls.filter(url => !content.includes(url));
      pendingUrls.length = 0;

      if (missingUrls.length === 0) return;

      const imageMarkdown = missingUrls.map(url => `\n\n![Screenshot](${url})`).join("");
      console.log(`[media-upload] appended ${missingUrls.length} missing URL(s) to message`);
      return { content: content + imageMarkdown };
    },
    { priority: 10 }
  );

  console.log("[media-upload] registered after_tool_call + tool_result_persist + message_sending hooks");
}

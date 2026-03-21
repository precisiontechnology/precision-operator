import { uploadToR2FromBuffer, uploadToR2 } from "./r2-client.js";
import { scanForLocalPaths, filterExistingFiles } from "./path-scanner.js";

const uploadedPathMap = new Map<string, string>();
const pendingUrls: string[] = [];

export default function register(api: any) {

  // ============================================================
  // HOOK 1: after_tool_call (async, observe-only)
  // ============================================================
  api.on(
    "after_tool_call",
    async (event: any, ctx: any) => {
      console.log(`[media-upload:after_tool_call] FIRED — toolName="${event.toolName}" ctx.toolName="${ctx?.toolName}"`);
      console.log(`[media-upload:after_tool_call] event keys: ${Object.keys(event).join(", ")}`);
      console.log(`[media-upload:after_tool_call] result type: ${typeof event.result}, is null: ${event.result == null}`);

      if (event.result) {
        const r = event.result as any;
        console.log(`[media-upload:after_tool_call] result keys: ${Object.keys(r).join(", ")}`);
        const content = r.content || r;
        console.log(`[media-upload:after_tool_call] content isArray: ${Array.isArray(content)}, length: ${Array.isArray(content) ? content.length : "n/a"}`);

        if (Array.isArray(content)) {
          content.forEach((block: any, i: number) => {
            console.log(`[media-upload:after_tool_call] block[${i}] type="${block?.type}" hasText=${typeof block?.text === "string"} textLen=${block?.text?.length ?? 0} hasSource=${!!block?.source}`);
            if (typeof block?.text === "string" && block.text.length < 500) {
              console.log(`[media-upload:after_tool_call] block[${i}] text: "${block.text.substring(0, 200)}"`);
            }
          });
        }
      }

      const name = (event.toolName || ctx?.toolName || "").toLowerCase();
      if (!name.includes("browser") && !name.includes("screenshot")) {
        console.log(`[media-upload:after_tool_call] SKIP — not browser/screenshot tool`);
        return;
      }

      const result = event.result as any;
      if (!result) { console.log(`[media-upload:after_tool_call] SKIP — no result`); return; }

      const content = result.content || result;
      if (!Array.isArray(content)) { console.log(`[media-upload:after_tool_call] SKIP — content not array`); return; }

      for (const block of content) {
        if (!block) continue;

        if (block.type === "image" && block.source?.type === "base64") {
          console.log(`[media-upload:after_tool_call] FOUND base64 image block, uploading...`);
          const mediaType = block.source.media_type || "image/png";
          const ext = mediaType.split("/")[1] || "png";
          const filename = `screenshot-${Date.now()}.${ext}`;
          const buffer = Buffer.from(block.source.data, "base64");
          const url = await uploadToR2FromBuffer(buffer, filename, mediaType);
          if (url) {
            pendingUrls.push(url);
            console.log(`[media-upload:after_tool_call] base64 screenshot uploaded: ${url}`);
          }
        }

        if ((block.type === "text" || typeof block.text === "string") && typeof block.text === "string") {
          const matches = scanForLocalPaths(block.text);
          console.log(`[media-upload:after_tool_call] text block scan: ${matches.length} path(s) found`);
          if (matches.length > 0) {
            const existing = await filterExistingFiles(matches);
            console.log(`[media-upload:after_tool_call] ${existing.length} file(s) exist on disk`);
            for (const match of existing) {
              const url = await uploadToR2(match.path);
              if (url) {
                uploadedPathMap.set(match.path, url);
                // Also map the basename
                const basename = match.path.split("/").pop();
                if (basename) uploadedPathMap.set(basename, url);
                pendingUrls.push(url);
                console.log(`[media-upload:after_tool_call] file uploaded: ${match.path} → ${url}`);
              }
            }
          }
        }
      }

      console.log(`[media-upload:after_tool_call] END — uploadedPathMap size: ${uploadedPathMap.size}, pendingUrls: ${pendingUrls.length}`);
    },
    { priority: 5 }
  );

  // ============================================================
  // HOOK 2: tool_result_persist (sync, CAN modify result)
  // ============================================================
  api.registerHook(
    "tool_result_persist",
    (event: any, ctx: any) => {
      console.log(`[media-upload:tool_result_persist] FIRED — toolName="${event.toolName}" ctx.toolName="${ctx?.toolName}"`);
      console.log(`[media-upload:tool_result_persist] uploadedPathMap size: ${uploadedPathMap.size}`);
      console.log(`[media-upload:tool_result_persist] pendingUrls: ${pendingUrls.length}`);

      if (uploadedPathMap.size === 0 && pendingUrls.length === 0) {
        console.log(`[media-upload:tool_result_persist] SKIP — no URLs to inject`);
        return;
      }

      const name = (event.toolName || ctx?.toolName || "").toLowerCase();
      console.log(`[media-upload:tool_result_persist] resolved name: "${name}"`);

      const msg = event.message;
      if (!msg) { console.log(`[media-upload:tool_result_persist] SKIP — no message`); return; }

      console.log(`[media-upload:tool_result_persist] message.role="${msg.role}" content isArray=${Array.isArray(msg.content)} content length=${msg.content?.length}`);

      if (!Array.isArray(msg.content)) {
        console.log(`[media-upload:tool_result_persist] SKIP — content not array`);
        return;
      }

      let modified = false;

      for (let i = 0; i < msg.content.length; i++) {
        const block = msg.content[i];
        if (!block || typeof block.text !== "string") continue;

        console.log(`[media-upload:tool_result_persist] checking block[${i}] text (${block.text.length} chars): "${block.text.substring(0, 150)}..."`);

        let text = block.text;

        // Replace local paths with R2 URLs from the map
        for (const [localPath, r2Url] of uploadedPathMap) {
          if (text.includes(localPath)) {
            text = text.replaceAll(localPath, r2Url);
            modified = true;
            console.log(`[media-upload:tool_result_persist] replaced "${localPath}" → "${r2Url}"`);
          }
        }

        // If we have pending URLs and nothing was replaced, append instruction
        if (!modified && pendingUrls.length > 0) {
          const url = pendingUrls[pendingUrls.length - 1];
          text += `\n\n[Screenshot available at: ${url}]\nYou MUST include this in your reply as: ![Screenshot](${url})`;
          modified = true;
          console.log(`[media-upload:tool_result_persist] appended URL instruction: ${url}`);
        }

        if (modified) {
          msg.content[i] = { ...block, text };
        }
      }

      if (modified) {
        console.log(`[media-upload:tool_result_persist] RETURNING modified message`);
        uploadedPathMap.clear();
        return { message: msg };
      } else {
        console.log(`[media-upload:tool_result_persist] no modifications made`);
      }
    },
    { name: "media-upload.tool-result-persist", description: "Rewrite screenshot paths to R2 URLs" }
  );

  // ============================================================
  // HOOK 3: message_sending (async, for Telegram/channels)
  // ============================================================
  api.on(
    "message_sending",
    async (event: any) => {
      console.log(`[media-upload:message_sending] FIRED — to="${event.to}" contentLen=${event.content?.length ?? 0} pendingUrls=${pendingUrls.length}`);

      const { content } = event;
      if (!content || pendingUrls.length === 0) {
        console.log(`[media-upload:message_sending] SKIP — no content or no pending URLs`);
        return;
      }

      const missingUrls = pendingUrls.filter(url => !content.includes(url));
      console.log(`[media-upload:message_sending] missing URLs: ${missingUrls.length}`);
      pendingUrls.length = 0;

      if (missingUrls.length === 0) return;

      const imageMarkdown = missingUrls.map(url => `\n\n![Screenshot](${url})`).join("");
      console.log(`[media-upload:message_sending] appending ${missingUrls.length} URL(s)`);
      return { content: content + imageMarkdown };
    },
    { priority: 10 }
  );

  console.log("[media-upload] registered after_tool_call + tool_result_persist + message_sending hooks (DEBUG MODE)");
}

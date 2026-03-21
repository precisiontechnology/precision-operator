import { scanForLocalPaths, filterExistingFiles } from "./path-scanner.js";
import { uploadToR2 } from "./r2-client.js";

export default function register(api: any) {
  api.on(
    "message_sending",
    async (event: { to: string; content: string; metadata?: Record<string, unknown> }) => {
      const { content } = event;
      if (!content) return;

      // Scan for local file paths
      const matches = scanForLocalPaths(content);
      if (matches.length === 0) return;

      // Filter to files that actually exist on disk
      const existing = await filterExistingFiles(matches);
      if (existing.length === 0) return;

      // Upload each file and collect replacements
      let rewritten = content;
      // Process in reverse order to preserve string indices
      const sorted = [...existing].sort((a, b) => b.start - a.start);

      for (const match of sorted) {
        const publicUrl = await uploadToR2(match.path);
        if (publicUrl) {
          // Find the original (unexpanded) path in the content and replace
          const originalMatch = scanForLocalPaths(rewritten).find(
            (m) => m.start === match.start || rewritten.slice(m.start, m.end).includes(match.path.split("/").pop()!)
          );
          if (originalMatch) {
            rewritten =
              rewritten.slice(0, originalMatch.start) +
              publicUrl +
              rewritten.slice(originalMatch.end);
          }
          console.log(`[media-upload] ${match.path} → ${publicUrl}`);
        }
      }

      // Safety: strip any remaining local paths that weren't uploaded
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

  console.log("[media-upload] registered message_sending hook");
}

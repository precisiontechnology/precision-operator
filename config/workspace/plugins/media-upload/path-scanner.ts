import { access } from "fs/promises";
import { constants } from "fs";

// Match common local file paths in message text
// Covers /tmp/*, /home/*, /var/*, ~/.openclaw/*, absolute paths with media extensions
const LOCAL_PATH_REGEX = /(?:\/(?:tmp|home|var|Users|root)\/[^\s"'<>)}\]]+\.(?:png|jpg|jpeg|gif|webp|pdf|csv|md|json|txt))|(?:~\/[^\s"'<>)}\]]+\.(?:png|jpg|jpeg|gif|webp|pdf|csv|md|json|txt))/gi;

export interface FileMatch {
  path: string;
  start: number;
  end: number;
}

export function scanForLocalPaths(content: string): FileMatch[] {
  const matches: FileMatch[] = [];
  let match: RegExpExecArray | null;

  // Reset lastIndex for global regex
  LOCAL_PATH_REGEX.lastIndex = 0;

  while ((match = LOCAL_PATH_REGEX.exec(content)) !== null) {
    matches.push({
      path: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return matches;
}

export async function filterExistingFiles(matches: FileMatch[]): Promise<FileMatch[]> {
  const results: FileMatch[] = [];
  for (const m of matches) {
    // Expand ~ to home dir
    const resolved = m.path.startsWith("~/")
      ? m.path.replace("~", process.env.HOME || "/home/node")
      : m.path;
    try {
      await access(resolved, constants.R_OK);
      results.push({ ...m, path: resolved });
    } catch {
      // File doesn't exist or isn't readable — skip
    }
  }
  return results;
}

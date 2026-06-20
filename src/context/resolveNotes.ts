import { App } from "obsidian";
import { Agent, ContextNote } from "../types";

const FOLDER_FILE_CAP = 12;       // max notes pulled from context folders
const FOLDER_NOTE_MAXLEN = 2000;  // truncate each folder note to keep prompts sane

/**
 * Builds the context notes for an agent:
 * 1. notes it links to in `## Connections` + any @mentioned notes (full content);
 * 2. notes under the configured context folders (capped + truncated).
 */
export async function resolveNotes(
  app: App,
  agent: Agent,
  mentions: string[],
  folders: string[] = [],
): Promise<ContextNote[]> {
  const out: ContextNote[] = [];
  const seen = new Set<string>();

  const linkpaths = [...new Set([...agent.connections, ...mentions])];
  for (const lp of linkpaths) {
    const dest = (app.metadataCache as any).getFirstLinkpathDest(lp, agent.filePath);
    if (!dest || seen.has(dest.path)) continue;
    seen.add(dest.path);
    out.push({ path: dest.path, content: await app.vault.read(dest) });
  }

  const norm = folders.map((f) => f.replace(/\/+$/, "").trim()).filter(Boolean);
  if (norm.length) {
    let budget = FOLDER_FILE_CAP;
    for (const file of app.vault.getMarkdownFiles()) {
      if (budget <= 0) break;
      if (seen.has(file.path)) continue;
      if (file.path === agent.filePath) continue;
      const inFolder = norm.some((f) => file.path === `${f}.md` || file.path.startsWith(`${f}/`));
      if (!inFolder) continue;
      seen.add(file.path);
      const content = await app.vault.read(file);
      out.push({ path: file.path, content: content.slice(0, FOLDER_NOTE_MAXLEN) });
      budget--;
    }
  }

  return out;
}

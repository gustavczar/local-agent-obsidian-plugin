import { App } from "obsidian";
import { Agent, ContextNote } from "../types";
import { rankNotes } from "./searchVault";

const FOLDER_FILE_CAP = 12;       // max notes pulled from context folders
const FOLDER_NOTE_MAXLEN = 2000;  // truncate each folder note to keep prompts sane
const AUTO_CONSULT_CAP = 4;       // top vault hits to auto-include

/**
 * Builds the context notes for an agent:
 * 1. notes it links to in `## Connections` + any @mentioned notes (full content);
 * 2. notes under the configured context folders (capped + truncated);
 * 3. if no folders are set and autoConsult is on, the most relevant vault notes
 *    for the question (lightweight term ranking).
 */
export async function resolveNotes(
  app: App,
  agent: Agent,
  mentions: string[],
  folders: string[] = [],
  query = "",
  autoConsult = false,
): Promise<ContextNote[]> {
  const out: ContextNote[] = [];
  const seen = new Set<string>();

  const linkpaths = [...new Set([...agent.connections, ...mentions])];
  for (const lp of linkpaths) {
    const dest = app.metadataCache.getFirstLinkpathDest(lp, agent.filePath);
    if (!dest || seen.has(dest.path)) continue;
    seen.add(dest.path);
    out.push({ path: dest.path, content: await app.vault.read(dest) });
  }

  const norm = folders.map((f) => f.replace(/\/+$/, "").trim()).filter(Boolean);
  if (norm.length) {
    let budget = FOLDER_FILE_CAP;
    for (const file of app.vault.getMarkdownFiles()) {
      if (budget <= 0) break;
      if (seen.has(file.path) || file.path === agent.filePath) continue;
      const inFolder = norm.some((f) => file.path === `${f}.md` || file.path.startsWith(`${f}/`));
      if (!inFolder) continue;
      seen.add(file.path);
      const content = await app.vault.read(file);
      out.push({ path: file.path, content: content.slice(0, FOLDER_NOTE_MAXLEN) });
      budget--;
    }
  } else if (autoConsult && query.trim()) {
    // No explicit folders → auto-consult the vault for the most relevant notes.
    const files = app.vault.getMarkdownFiles();
    const byPath = new Map(files.map((f) => [f.path, f]));
    const hits = rankNotes(query, files.map((f) => ({ path: f.path, text: `${f.basename} ${f.path}` })), AUTO_CONSULT_CAP + 1);
    for (const hit of hits) {
      if (seen.has(hit.path) || hit.path === agent.filePath) continue;
      const file = byPath.get(hit.path);
      if (!file) continue;
      seen.add(hit.path);
      const content = await app.vault.read(file);
      out.push({ path: hit.path, content: content.slice(0, FOLDER_NOTE_MAXLEN) });
      if (out.length >= linkpaths.length + AUTO_CONSULT_CAP) break;
    }
  }

  return out;
}

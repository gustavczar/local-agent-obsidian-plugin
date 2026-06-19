import { App } from "obsidian";
import { Agent, ContextNote } from "../types";

export async function resolveNotes(app: App, agent: Agent, mentions: string[]): Promise<ContextNote[]> {
  const linkpaths = [...new Set([...agent.connections, ...mentions])];
  const out: ContextNote[] = [];
  const seen = new Set<string>();
  for (const lp of linkpaths) {
    const dest = (app.metadataCache as any).getFirstLinkpathDest(lp, agent.filePath);
    if (!dest || seen.has(dest.path)) continue;
    seen.add(dest.path);
    out.push({ path: dest.path, content: await app.vault.read(dest) });
  }
  return out;
}

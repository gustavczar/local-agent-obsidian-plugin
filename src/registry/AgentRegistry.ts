import { App, TFile } from "obsidian";
import { Agent } from "../types";
import { parseAgent } from "./parseAgent";

function isAgentFrontmatter(fm: Record<string, any> | undefined): boolean {
  if (!fm) return false;
  const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : [];
  return tags.some((t) => /#?sistema\/sub-agente/i.test(t)) || tags.some((t) => /#?agente\//i.test(t));
}

export class AgentRegistry {
  private agents = new Map<string, Agent>();
  private listeners: Array<() => void> = [];

  constructor(private app: App, private folder: string) {}

  onChange(cb: () => void) { this.listeners.push(cb); }
  private emit() { for (const cb of this.listeners) cb(); }
  all(): Agent[] { return [...this.agents.values()]; }
  get(name: string): Agent | undefined { return this.agents.get(name); }

  private underFolder(path: string): boolean {
    return path.startsWith(this.folder.replace(/\/+$/, "") + "/");
  }

  async load(): Promise<void> {
    this.agents.clear();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!this.underFolder(file.path)) continue;
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (!isAgentFrontmatter(fm)) continue;
      const body = await this.app.vault.read(file);
      const agent = parseAgent(fm!, stripFrontmatter(body), file.path);
      this.agents.set(agent.name, agent);
    }
    this.emit();
  }

  registerVaultEvents(): void {
    const reload = () => void this.load();
    this.app.vault.on("create", reload);
    this.app.vault.on("modify", reload);
    this.app.vault.on("delete", reload);
    this.app.vault.on("rename", reload);
  }
}

function stripFrontmatter(content: string): string {
  if (content.startsWith("---")) {
    const end = content.indexOf("\n---", 3);
    if (end !== -1) return content.slice(content.indexOf("\n", end + 1) + 1);
  }
  return content;
}

import { App } from "obsidian";
import { Agent } from "../types";
import { parseAgent } from "./parseAgent";
import { isSquadFrontmatter } from "../squad/parseSquad";

export interface NameCollision {
  name: string;
  kept: string;      // file that owns the name
  ignored: string;   // file that was skipped
}

export class AgentRegistry {
  private agents = new Map<string, Agent>();
  // Two files claiming the same `name` used to silently overwrite each other, so an
  // agent copied from another would just never appear. Collisions are recorded here.
  private collisions: NameCollision[] = [];
  private listeners: Array<() => void> = [];
  private reloadTimer: number | null = null;

  constructor(private app: App, private folder: string) {}

  onChange(cb: () => void) { this.listeners.push(cb); }
  private emit() { for (const cb of this.listeners) cb(); }
  all(): Agent[] { return [...this.agents.values()]; }

  /** Files that lost their name to an earlier file. Empty when the folder is clean. */
  duplicates(): NameCollision[] { return [...this.collisions]; }
  get(name: string): Agent | undefined { return this.agents.get(name); }

  setFolder(folder: string) { this.folder = folder; }

  private underFolder(path: string): boolean {
    return path.startsWith(this.folder.replace(/\/+$/, "") + "/");
  }

  // Every markdown file under the agents folder is treated as an agent.
  async load(): Promise<void> {
    this.agents.clear();
    this.collisions = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!this.underFolder(file.path)) continue;
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      if (isSquadFrontmatter(fm)) continue; // squad notes are not agents
      const body = await this.app.vault.read(file);
      const agent = parseAgent(fm, stripFrontmatter(body), file.path);
      const clash = this.agents.get(agent.name);
      if (clash) {
        // First file wins, so a reload does not reshuffle which one survives.
        this.collisions.push({ name: agent.name, kept: clash.filePath, ignored: file.path });
        continue;
      }
      this.agents.set(agent.name, agent);
    }
    this.emit();
  }

  private scheduleReload() {
    if (this.reloadTimer != null) window.clearTimeout(this.reloadTimer);
    this.reloadTimer = window.setTimeout(() => { this.reloadTimer = null; void this.load(); }, 300);
  }

  registerVaultEvents(): void {
    const r = () => this.scheduleReload();
    this.app.vault.on("create", r);
    this.app.vault.on("modify", r);
    this.app.vault.on("delete", r);
    this.app.vault.on("rename", r);
    this.app.metadataCache.on("changed", r);
  }
}

export function stripFrontmatter(content: string): string {
  if (content.startsWith("---")) {
    const end = content.indexOf("\n---", 3);
    if (end !== -1) return content.slice(content.indexOf("\n", end + 1) + 1);
  }
  return content;
}

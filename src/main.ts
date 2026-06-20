import { Plugin, WorkspaceLeaf, Notice } from "obsidian";
import { withDefaults, PersistedData } from "./store/PluginStore";
import { AgentRegistry } from "./registry/AgentRegistry";
import { OfficeView, OFFICE_VIEW } from "./office/OfficeView";
import { ChatView, CHAT_VIEW } from "./chat/ChatView";
import { ChatSession } from "./chat/ChatSession";
import { resolveNotes } from "./context/resolveNotes";
import { makeAdapter } from "./providers/ProviderAdapter";
import { buildConversationNote } from "./chat/crystallize";
import { SettingsTab } from "./settings/SettingsTab";
import { Agent } from "./types";

export default class LocalAgentOfficePlugin extends Plugin {
  data!: PersistedData;
  registry!: AgentRegistry;
  private office: OfficeView | null = null;

  async onload() {
    this.data = withDefaults(await this.loadData());
    this.registry = new AgentRegistry(this.app, this.data.agentsFolder);

    this.registerView(OFFICE_VIEW, (leaf) => {
      this.office = new OfficeView(
        leaf, this.registry,
        () => this.data.positions,
        (name, pos) => { this.data.positions[name] = pos; void this.persist(); },
        (name) => this.openChatFor(name),
      );
      return this.office;
    });

    this.registerView(CHAT_VIEW, (leaf) => new ChatView(
      leaf,
      (agent) => this.makeSession(agent),
      (name, working) => this.office?.setWorking(name, working),
      (agent, session) => this.crystallize(agent, session),
      () => this.registry.all(),
    ));

    this.addRibbonIcon("building-2", "Open Agent Office", () => void this.openOffice());
    this.addCommand({ id: "open-agent-office", name: "Open Agent Office", callback: () => void this.openOffice() });
    this.addSettingTab(new SettingsTab(this.app, this));

    await this.registry.load();
    this.registry.registerVaultEvents();
  }

  async persist() { await this.saveData(this.data); }

  private makeSession(agent: Agent): ChatSession {
    const cfg = this.data.providers.find((p) => p.id === this.data.activeProviderId);
    if (!cfg) { new Notice("Configure um provider ativo nas settings."); throw new Error("No active provider"); }
    return new ChatSession(agent, makeAdapter(cfg), (a, mentions) => resolveNotes(this.app, a, mentions, this.data.contextFolders));
  }

  private async openOffice() {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: OFFICE_VIEW, active: true });
  }

  private async openChatFor(agentName: string) {
    const agent = this.registry.get(agentName);
    if (!agent) return;
    const leaf: WorkspaceLeaf = this.app.workspace.getLeaf("split", "vertical");
    await leaf.setViewState({ type: CHAT_VIEW, active: true });
    const view = leaf.view as ChatView;
    view.setAgent(agent);
  }

  private async crystallize(agent: Agent, session: ChatSession) {
    if (!session.messages.length) { new Notice("Nada para cristalizar ainda."); return; }
    const now = new Date();
    const md = buildConversationNote(agent, session.messages, now);
    const safe = agent.name.replace(/[\\/:*?"<>|]/g, "-");
    const folder = (this.data.conversationsFolder ?? "").replace(/\/+$/, "").trim();
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try { await this.app.vault.createFolder(folder); } catch { /* already exists */ }
    }
    const fileName = `Conversa ${safe} ${now.toISOString().slice(0, 10)} ${now.getTime()}.md`;
    const path = folder ? `${folder}/${fileName}` : fileName;
    await this.app.vault.create(path, md);
    new Notice(`Cristalizado: ${path}`);
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(OFFICE_VIEW);
    this.app.workspace.detachLeavesOfType(CHAT_VIEW);
  }
}

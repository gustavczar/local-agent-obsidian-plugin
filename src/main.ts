import { Plugin, WorkspaceLeaf, Notice, TFile } from "obsidian";
import { withDefaults, PersistedData } from "./store/PluginStore";
import { AgentRegistry } from "./registry/AgentRegistry";
import { OfficeView, OFFICE_VIEW } from "./office/OfficeView";
import { ChatView, CHAT_VIEW } from "./chat/ChatView";
import { ChatSession } from "./chat/ChatSession";
import { resolveNotes } from "./context/resolveNotes";
import { makeAdapter } from "./providers/ProviderAdapter";
import { buildConversationNote } from "./chat/crystallize";
import { SettingsTab } from "./settings/SettingsTab";
import { AddAgentModal, NewAgentOpts } from "./office/AddAgentModal";
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
        () => this.openAddAgent(),
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

  private openAddAgent() {
    const rooms = [...new Set(this.registry.all().map((a) => a.room))].sort();
    new AddAgentModal(this.app, rooms, (o) => void this.createAgent(o)).open();
  }

  private async createAgent(o: NewAgentOpts) {
    const folder = (this.data.agentsFolder ?? "").replace(/\/+$/, "").trim();
    const safe = o.name.trim().replace(/[\\/:*?"<>|]/g, "-");
    if (!safe) { new Notice("Nome inválido."); return; }
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try { await this.app.vault.createFolder(folder); } catch { /* exists */ }
    }
    const path = folder ? `${folder}/${safe}.md` : `${safe}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) { new Notice("Já existe um agente com esse nome."); return; }

    const roomSlug = (o.room || "geral").trim().toLowerCase().replace(/\s+/g, "-") || "geral";
    const title = o.title.trim() || safe;
    const fm = [
      "---",
      `name: ${safe}`,
      `title: ${title}`,
      ...(o.icon.trim() ? [`icon: "${o.icon.trim()}"`] : []),
      ...(o.color.trim() ? [`color: "${o.color.trim()}"`] : []),
      "tags:",
      `  - "#agente/${roomSlug}"`,
      `  - "#sistema/sub-agente"`,
      "---",
    ];
    const body = o.template === "min"
      ? [
          "",
          `You are ${title}. [descreva o propósito do agente em uma frase].`,
          "",
          "## Conexões",
          "- ",
          "",
        ]
      : [
          "",
          `You are ${title} — [seu papel em uma linha]. [Propósito central em uma frase forte].`,
          "",
          "## Personalidade",
          "[Tom e estilo. O que você valoriza, como você fala, o que te diferencia.]",
          "",
          "## Domínio",
          "- [área de expertise 1]",
          "- [área de expertise 2]",
          "",
          "## Quando invocado",
          "1. Enquadre o problema em uma frase antes de responder.",
          "2. [método central — como você ataca o problema]",
          "3. [análise / processamento]",
          "4. [formato da entrega: o que você devolve e como]",
          "",
          "## Regras",
          "- [uma regra inegociável]",
          "- [um limite de estilo — o que você nunca faz]",
          "- Cite sempre a nota/fonte real do cofre; nunca invente evidência.",
          "",
          'Termine sempre com: "[sua frase de assinatura]."',
          "",
          "## Conexões",
          "- [[MOC ou nota do domínio]]",
          "- ",
          "",
        ];
    const file = await this.app.vault.create(path, fm.concat(body).join("\n"));
    await this.registry.load();
    await this.app.workspace.getLeaf(true).openFile(file as TFile);
    new Notice(`Agente criado: ${safe}`);
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

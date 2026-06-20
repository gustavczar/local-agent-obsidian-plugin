import { Plugin, WorkspaceLeaf, Notice, TFile, Editor } from "obsidian";
import { displayName } from "./office/avatar";
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
import { ARCHITECT_SYSTEM, extractAgentNote, parseNameFromNote } from "./office/architectPrompt";
import { buildCanvas } from "./canvas/buildCanvas";
import { parseCanvasSpec } from "./canvas/parseCanvasSpec";
import { Agent, ChatMessage } from "./types";

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
    this.addCommand({
      id: "answer-inline-mention",
      name: "Responder @menção na linha atual",
      editorCallback: (editor) => void this.answerInlineMention(editor),
    });
    this.addCommand({
      id: "generate-canvas-mention",
      name: "Gerar Canvas da @menção na linha atual",
      editorCallback: (editor) => void this.generateCanvasFromMention(editor),
    });
    this.addSettingTab(new SettingsTab(this.app, this));

    await this.registry.load();
    this.registry.registerVaultEvents();
  }

  async persist() { await this.saveData(this.data); }

  private makeSession(agent: Agent): ChatSession {
    const cfg = this.data.providers.find((p) => p.id === this.data.activeProviderId);
    if (!cfg) { new Notice("Configure um provider ativo nas settings."); throw new Error("No active provider"); }
    return new ChatSession(agent, makeAdapter(cfg), (a, mentions, query) =>
      resolveNotes(this.app, a, mentions, this.data.contextFolders, query, this.data.autoConsultVault));
  }

  private async openOffice() {
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: OFFICE_VIEW, active: true });
  }

  // Parse "@Agent: rest" on a line and resolve the agent.
  private parseMentionLine(line: string): { agent: Agent; rest: string } | null {
    const m = line.match(/@([^:：]+?)\s*[:：]\s*(.+)$/);
    if (!m) return null;
    const token = m[1].trim().toLowerCase();
    const agent = this.registry.all().find(
      (a) => a.name.toLowerCase() === token || displayName(a).toLowerCase() === token,
    );
    if (!agent) { new Notice(`Agente "@${m[1].trim()}" não encontrado.`); return null; }
    return { agent, rest: m[2].trim() };
  }

  // Run an agent once and return its full reply (or null on error/no provider).
  private async runAgentReply(agent: Agent, message: string): Promise<string | null> {
    let session: ChatSession;
    try { session = this.makeSession(agent); } catch { return null; }
    const notice = new Notice(`${displayName(agent)} está pensando…`, 0);
    let reply = "";
    const off = session.onToken((t) => { reply += t; });
    try { await session.send(message, []); }
    catch (e) { off(); notice.hide(); new Notice(`⚠️ ${(e as Error).message}`); return null; }
    off(); notice.hide();
    return reply;
  }

  // Build #2 — @agent in notes: answer the "@Agent: question" on the cursor line, inline.
  private async answerInlineMention(editor: Editor) {
    const lineIdx = editor.getCursor().line;
    const parsed = this.parseMentionLine(editor.getLine(lineIdx));
    if (!parsed) { new Notice("Formato: @Agente: sua pergunta — na linha do cursor."); return; }

    const reply = await this.runAgentReply(parsed.agent, parsed.rest);
    if (reply == null) return;

    const quoted = (reply.trim() || "(sem resposta)").split("\n").map((l) => `> ${l}`).join("\n");
    const block = `\n\n> [!agent]+ ${parsed.agent.title}\n${quoted}\n`;
    editor.replaceRange(block, { line: lineIdx, ch: editor.getLine(lineIdx).length });
    new Notice(`${displayName(parsed.agent)} respondeu.`);
  }

  // Epic A — agent → native Canvas: turn "@Agent: topic" into a .canvas mind map.
  private async generateCanvasFromMention(editor: Editor) {
    const lineIdx = editor.getCursor().line;
    const parsed = this.parseMentionLine(editor.getLine(lineIdx));
    if (!parsed) { new Notice("Formato: @Agente: tópico do mapa."); return; }

    const prompt = [
      `Crie um mapa visual (mind map) sobre: "${parsed.rest}".`,
      "Responda APENAS com um JSON válido, sem nenhum texto fora dele, no formato:",
      '{"nodes":[{"id":"1","text":"..."}],"edges":[{"from":"1","to":"2","label":"..."}]}',
      "Use de 5 a 9 nós curtos e bem conectados.",
    ].join(" ");

    const reply = await this.runAgentReply(parsed.agent, prompt);
    if (reply == null) return;

    const spec = parseCanvasSpec(reply);
    if (!spec) { new Notice("O agente não retornou um mapa válido — tente novamente."); return; }

    const folder = (this.data.conversationsFolder ?? "").replace(/\/+$/, "").trim();
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try { await this.app.vault.createFolder(folder); } catch { /* exists */ }
    }
    const safe = (parsed.rest.slice(0, 40).replace(/[\\/:*?"<>|]/g, "-").trim()) || "mapa";
    let path = (folder ? `${folder}/` : "") + `${safe} (canvas).canvas`;
    if (this.app.vault.getAbstractFileByPath(path)) path = (folder ? `${folder}/` : "") + `${safe} ${Date.now()}.canvas`;

    const file = await this.app.vault.create(path, buildCanvas(spec));
    await this.app.workspace.getLeaf(true).openFile(file as TFile);
    new Notice(`Canvas gerado por ${displayName(parsed.agent)}.`);
  }

  private openAddAgent() {
    const rooms = [...new Set(this.registry.all().map((a) => a.room))].sort();
    new AddAgentModal(
      this.app,
      rooms,
      (o) => void this.createAgent(o),
      (desc) => void this.generateAgentWithAI(desc),
    ).open();
  }

  // Epic B — "IA cria o agente": describe it, an architect generates the full persona note.
  private async generateAgentWithAI(description: string) {
    const cfg = this.data.providers.find((p) => p.id === this.data.activeProviderId);
    if (!cfg) { new Notice("Configure um provider ativo nas settings."); return; }

    const notice = new Notice("Arquiteto criando o agente…", 0);
    const msgs: ChatMessage[] = [{ role: "user", content: description }];
    let reply = "";
    try {
      for await (const t of makeAdapter(cfg).stream(msgs, { system: ARCHITECT_SYSTEM })) reply += t;
    } catch (e) {
      notice.hide();
      new Notice(`⚠️ ${(e as Error).message}`);
      return;
    }
    notice.hide();

    const note = extractAgentNote(reply);
    if (!note) { new Notice("A IA não retornou uma nota de agente válida — tente de novo."); return; }

    const rawName = parseNameFromNote(note) || description.slice(0, 30);
    const safe = rawName.replace(/[\\/:*?"<>|]/g, "-").trim() || "agente";
    const folder = (this.data.agentsFolder ?? "").replace(/\/+$/, "").trim();
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try { await this.app.vault.createFolder(folder); } catch { /* exists */ }
    }
    let path = (folder ? `${folder}/` : "") + `${safe}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) path = (folder ? `${folder}/` : "") + `${safe} ${Date.now()}.md`;

    const file = await this.app.vault.create(path, note);
    await this.registry.load();
    await this.app.workspace.getLeaf(true).openFile(file as TFile);
    new Notice(`Agente criado pela IA: ${safe}`);
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
          `You are ${title} — [seu papel em uma linha]. [Propósito central em uma frase forte: por que você existe].`,
          "",
          "## Personalidade",
          "- **Voz:** [tom, ritmo, vocabulário característico de como você fala]",
          "- **Valores:** [o que você defende; o que você despreza]",
          "- **Vieses produtivos:** [as lentes que você sempre aplica]",
          "",
          "## Domínio",
          "- [área de expertise 1]",
          "- [área de expertise 2]",
          "- [autores/referências que você cita como velhos amigos]",
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
          "- Se faltar informação para uma boa resposta, peça — não invente.",
          "- Cite sempre a nota/fonte real do cofre; nunca invente evidência.",
          "",
          "## Gatilhos de delegação",
          "- Se a pergunta sair do seu domínio, sugira o agente certo: [[outro-agente]].",
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
    const leaf: WorkspaceLeaf | null = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: CHAT_VIEW, active: true });
    this.app.workspace.revealLeaf(leaf);
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

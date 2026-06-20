import { Plugin, WorkspaceLeaf, Notice, TFile, Editor } from "obsidian";
import { displayName, baseName, roleText } from "./office/avatar";
import { withDefaults, PersistedData } from "./store/PluginStore";
import { AgentRegistry } from "./registry/AgentRegistry";
import { OfficeView, OFFICE_VIEW } from "./office/OfficeView";
import { ChatView, CHAT_VIEW } from "./chat/ChatView";
import { ChatSession } from "./chat/ChatSession";
import { resolveNotes } from "./context/resolveNotes";
import { buildPrompt } from "./context/ContextBuilder";
import { makeAdapter } from "./providers/ProviderAdapter";
import { buildConversationNote } from "./chat/crystallize";
import { SettingsTab } from "./settings/SettingsTab";
import { AddAgentModal, NewAgentOpts } from "./office/AddAgentModal";
import { ConnectModal, ConnectItem } from "./office/ConnectModal";
import { addConnectionToBody } from "./office/addConnection";
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
        (name) => this.connectAgent(name),
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

  // Parse "@Agent: rest" on a line and resolve the agent (silent — returns null if not found).
  private parseMentionLine(line: string): { agent: Agent; rest: string } | null {
    const m = line.match(/@([^:：]+?)\s*[:：]\s*(.+)$/);
    if (!m) return null;
    const token = m[1].trim().toLowerCase();
    const agent = this.registry.all().find(
      (a) => a.name.toLowerCase() === token || baseName(a.filePath).toLowerCase() === token || displayName(a).toLowerCase() === token,
    );
    return agent ? { agent, rest: m[2].trim() } : null;
  }

  // Find the @mention nearest the cursor (cursor line first, then closest line in the note).
  private findMention(editor: Editor): { lineIdx: number; agent: Agent; rest: string } | null {
    const cur = editor.getCursor().line;
    const onCur = this.parseMentionLine(editor.getLine(cur));
    if (onCur) return { lineIdx: cur, ...onCur };
    let best: { lineIdx: number; agent: Agent; rest: string } | null = null;
    let bestDist = Infinity;
    for (let i = 0; i < editor.lineCount(); i++) {
      const p = this.parseMentionLine(editor.getLine(i));
      if (!p) continue;
      const d = Math.abs(i - cur);
      if (d < bestDist) { bestDist = d; best = { lineIdx: i, ...p }; }
    }
    return best;
  }

  private mentionHelp(): string {
    const names = this.registry.all().map((a) => displayName(a)).slice(0, 10).join(", ");
    return `Escreva "@Agente: sua pergunta" na nota. Agentes: ${names || "(nenhum — crie em + Agente)"}.`;
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

  // Low-level single call to an agent (with its vault context + optional delegation directive).
  private async rawAgentCall(agent: Agent, message: string, delegates: string[]): Promise<string | null> {
    const cfg = this.data.providers.find((p) => p.id === this.data.activeProviderId);
    if (!cfg) { new Notice("Configure um provider ativo nas settings."); return null; }
    const notes = await resolveNotes(this.app, agent, [], this.data.contextFolders, message, this.data.autoConsultVault);
    const { system, messages } = buildPrompt(agent, [{ role: "user", content: message }], notes, delegates);
    let reply = "";
    try { for await (const t of makeAdapter(cfg).stream(messages, { system })) reply += t; }
    catch (e) { new Notice(`⚠️ ${(e as Error).message}`); return null; }
    return reply;
  }

  // Deterministic router: a short classification call picks the best-fit agent for the question.
  private async routePick(agent: Agent, question: string, candidates: Agent[]): Promise<Agent | null> {
    const cfg = this.data.providers.find((p) => p.id === this.data.activeProviderId);
    if (!cfg) return null;
    const roster = candidates.map((c) => `- ${displayName(c)} — ${roleText(c) || c.room}`).join("\n");
    const system = "Você é um roteador que distribui perguntas para o agente certo de um time. Seja preciso.";
    const msg =
      `O usuário direcionou esta pergunta a "${displayName(agent)}".\n` +
      `Pergunta: "${question}"\n\nAgentes disponíveis (nome — especialidade):\n${roster}\n\n` +
      `Qual UM agente é o mais adequado para responder? Se "${displayName(agent)}" já for adequado, responda o nome dele. ` +
      `Responda APENAS com o nome exato do agente, nada mais.`;
    let reply = "";
    try { for await (const t of makeAdapter(cfg).stream([{ role: "user", content: msg }], { system })) reply += t; }
    catch { return null; }
    const name = reply.trim().toLowerCase().replace(/["'.\n]/g, "").trim();
    if (!name) return null;
    return (
      candidates.find((c) => displayName(c).toLowerCase() === name || c.name.toLowerCase() === name) ??
      candidates.find((c) => name.includes(c.name.toLowerCase()) || (name.length > 2 && displayName(c).toLowerCase().includes(name))) ??
      null
    );
  }

  // Epic D — route the question to the best agent (one hop), then answer. onStage reports progress; office visuals too.
  private async runWithDelegation(
    agent: Agent,
    message: string,
    onStage?: (label: string) => void,
  ): Promise<{ text: string; via?: Agent } | null> {
    const office = this.office;
    const all = this.registry.all();
    office?.setActivity(agent.name, "working");
    onStage?.(`⏳ ${displayName(agent)} analisando…`);

    let answerer = agent;
    let via: Agent | undefined;
    if (this.data.autoDelegate && all.length > 1) {
      const pick = await this.routePick(agent, message, all);
      if (pick && pick.name !== agent.name) {
        answerer = pick;
        via = pick;
        office?.setActivity(agent.name, "waiting");
        office?.setActivity(pick.name, "working");
        office?.flashDelegation(agent.name, pick.name);
        onStage?.(`🤝 ${displayName(agent)} encaminhou para ${displayName(pick)}…`);
      } else {
        onStage?.(`⏳ ${displayName(agent)} pensando…`);
      }
    }

    const reply = await this.rawAgentCall(answerer, message, []);
    office?.setActivity(agent.name, "idle");
    if (via) office?.setActivity(via.name, "idle");
    if (reply == null) return null;
    return { text: reply.trim(), via };
  }

  // @agent in notes: insert a live status block under the nearest @mention and fill it with the answer.
  private async answerInlineMention(editor: Editor) {
    const found = this.findMention(editor);
    if (!found) { new Notice(this.mentionHelp()); return; }
    const { lineIdx, agent, rest } = found;

    const startOff = editor.posToOffset({ line: lineIdx, ch: editor.getLine(lineIdx).length });
    let curLen = 0;
    const write = (body: string) => {
      const block = `\n\n> [!agent]+ ${agent.title}\n${body}\n`;
      const from = editor.offsetToPos(startOff);
      const to = editor.offsetToPos(startOff + curLen);
      editor.replaceRange(block, from, to);
      curLen = block.length;
    };

    write("> ⏳ pensando…");
    const result = await this.runWithDelegation(agent, rest, (label) => write(`> ${label}`));
    if (!result) { write("> ⚠️ Sem resposta. Configure/cheque o provider ativo em ⚙ Configurações."); return; }

    const via = result.via ? `> 🤝 *${displayName(agent)} consultou [[${baseName(result.via.filePath)}]]:*\n>\n` : "";
    const quoted = (result.text || "(sem resposta)").split("\n").map((l) => `> ${l}`).join("\n");
    write(`${via}${quoted}`);
    new Notice(`${displayName(agent)} respondeu${result.via ? ` (via ${displayName(result.via)})` : ""}.`);
  }

  // Epic A — agent → native Canvas: turn "@Agent: topic" into a .canvas mind map.
  private async generateCanvasFromMention(editor: Editor) {
    const parsed = this.findMention(editor);
    if (!parsed) { new Notice(this.mentionHelp()); return; }

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

  // Epic D / Obsidian-native: generate a [[link]] from one agent to another agent or note.
  private connectAgent(sourceName: string) {
    const source = this.registry.get(sourceName);
    if (!source) return;

    const items: ConnectItem[] = [];
    for (const a of this.registry.all()) {
      if (a.name === sourceName) continue;
      items.push({ label: displayName(a), sublabel: "agente", linktext: baseName(a.filePath) });
    }
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (items.some((i) => i.linktext === f.basename)) continue;
      items.push({ label: f.basename, sublabel: "nota", linktext: f.basename });
    }

    new ConnectModal(this.app, items, async (it) => {
      const file = this.app.vault.getAbstractFileByPath(source.filePath);
      if (!(file instanceof TFile)) return;
      await this.app.vault.process(file, (data) => addConnectionToBody(data, it.linktext));
      await this.registry.load();
      new Notice(`${displayName(source)} → [[${it.linktext}]]`);
    }).open();
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

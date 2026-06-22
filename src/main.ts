import { Plugin, WorkspaceLeaf, Notice, TFile, Editor } from "obsidian";
import { displayName, baseName, roleText } from "./office/avatar";
import { withDefaults, PersistedData } from "./store/PluginStore";
import { AgentRegistry, stripFrontmatter } from "./registry/AgentRegistry";
import { validateAgent } from "./registry/validateAgent";
import { t, setLanguage } from "./i18n";
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
import { parseSquad, Squad } from "./squad/parseSquad";
import { buildSquadRun, SquadStepResult } from "./squad/buildSquadRun";
import { StepApprovalModal } from "./squad/StepApprovalModal";
import { Agent, ChatMessage, AgentAction } from "./types";
import { parseActions } from "./agency/parseActions";
import { resolveTargetPath, provenanceFooter, stripTrailingProvenance, addToMemory } from "./agency/agencyPrompt";
import { extractWikilinks } from "./context/extractWikilinks";
import { BrainstormModal } from "./brainstorm/BrainstormModal";
import { BrainstormProgressModal } from "./brainstorm/BrainstormProgressModal";
import { buildBrainstormTurnPrompt, buildFacilitatorPrompt, FACILITATOR_SYSTEM, Turn } from "./brainstorm/buildBrainstormPrompt";
import { buildBrainstormNote } from "./brainstorm/buildBrainstormNote";
import { ActionApprovalModal } from "./agency/ActionApprovalModal";
import { buildAgencyReport, ActionResult } from "./agency/buildAgencyReport";

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

export default class LocalAgentOfficePlugin extends Plugin {
  data!: PersistedData;
  registry!: AgentRegistry;
  private get office(): OfficeView | null {
    const leaf = this.app.workspace.getLeavesOfType(OFFICE_VIEW)[0];
    return leaf?.view instanceof OfficeView ? leaf.view : null;
  }

  async onload() {
    this.data = withDefaults(await this.loadData());
    setLanguage(this.data.language);
    this.registry = new AgentRegistry(this.app, this.data.agentsFolder);

    this.registerView(OFFICE_VIEW, (leaf) => new OfficeView(
      leaf, this.registry,
      () => this.data.positions,
      (name, pos) => { this.data.positions[name] = pos; void this.persist(); },
      (name) => this.openChatFor(name),
      () => this.openAddAgent(),
      (name) => this.connectAgent(name),
    ));

    this.registerView(CHAT_VIEW, (leaf) => new ChatView(
      leaf,
      (agent) => this.makeSession(agent),
      (name, working) => this.office?.setWorking(name, working),
      (agent, session) => this.crystallize(agent, session),
      () => this.registry.all(),
    ));

    this.addRibbonIcon("building-2", t("ribbon.openOffice"), () => void this.openOffice());
    this.addCommand({ id: "open-agent-office", name: t("cmd.openOffice"), callback: () => void this.openOffice() });
    this.addCommand({
      id: "answer-inline-mention",
      name: t("cmd.answerMention"),
      editorCallback: (editor) => void this.answerInlineMention(editor),
    });
    this.addCommand({
      id: "generate-canvas-mention",
      name: t("cmd.generateCanvas"),
      editorCallback: (editor) => void this.generateCanvasFromMention(editor),
    });
    this.addCommand({
      id: "run-squad",
      name: t("cmd.runSquad"),
      callback: () => void this.runSquadActive(),
    });
    this.addCommand({
      id: "act-on-vault",
      name: t("cmd.actOnVault"),
      editorCallback: (editor) => void this.actOnVault(editor),
    });
    this.addCommand({
      id: "brainstorm",
      name: t("cmd.brainstorm"),
      callback: () => void this.runBrainstorm(),
    });
    this.addCommand({
      id: "validate-agents",
      name: t("cmd.validateAgents"),
      callback: () => void this.validateAgents(),
    });
    this.addSettingTab(new SettingsTab(this.app, this));

    await this.registry.load();
    this.registry.registerVaultEvents();
  }

  private async validateAgents() {
    const agents = this.registry.all();
    if (!agents.length) { new Notice(t("notice.noAgentsInFolder")); return; }
    let errors = 0, warns = 0;
    const lines: string[] = [];
    for (const a of agents) {
      const file = this.app.vault.getAbstractFileByPath(a.filePath);
      if (!(file instanceof TFile)) continue;
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter ?? {};
      const body = stripFrontmatter(await this.app.vault.read(file));
      const issues = validateAgent(fm, body, a.filePath);
      if (!issues.length) continue;
      lines.push(`${displayName(a)} (${a.filePath}):`);
      for (const i of issues) {
        if (i.level === "error") errors++; else warns++;
        lines.push(`  ${i.level === "error" ? "❌" : "⚠️"} ${i.message}`);
      }
    }
    if (!lines.length) { new Notice(t("notice.allValid", { count: agents.length })); return; }
    console.log("[Local Agent Office] Agent validation:\n" + lines.join("\n"));
    new Notice(
      t("notice.validateSummary", { count: agents.length, errors, warns }) + "\n" +
      lines.slice(0, 12).join("\n") +
      (lines.length > 12 ? t("notice.validateMore") : ""),
      0,
    );
  }

  async persist() { await this.saveData(this.data); }

  private makeSession(agent: Agent): ChatSession {
    const cfg = this.data.providers.find((p) => p.id === this.data.activeProviderId);
    if (!cfg) { new Notice(t("notice.noProvider")); throw new Error("No active provider"); }
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
    return t("mention.help", { names: names || t("mention.none") });
  }

  // Run an agent once and return its full reply (or null on error/no provider).
  private async runAgentReply(agent: Agent, message: string): Promise<string | null> {
    let session: ChatSession;
    try { session = this.makeSession(agent); } catch { return null; }
    const notice = new Notice(t("notice.thinking", { agent: displayName(agent) }), 0);
    let reply = "";
    const off = session.onToken((t) => { reply += t; });
    try { await session.send(message, []); }
    catch (e) { off(); notice.hide(); new Notice(`⚠️ ${(e as Error).message}`); return null; }
    off(); notice.hide();
    return reply;
  }

  private resolveAgentRef(ref: string): Agent | undefined {
    const t = ref.trim().toLowerCase();
    return this.registry.all().find(
      (a) => a.name.toLowerCase() === t || baseName(a.filePath).toLowerCase() === t || displayName(a).toLowerCase() === t,
    );
  }

  // Epic D — orchestration: run a squad note's steps in sequence, with per-step approval. Each step feeds the next (X→Y).
  private async runSquadActive() {
    const file = this.app.workspace.getActiveFile();
    if (!file) { new Notice(t("notice.openSquadNote")); return; }
    const squad = parseSquad(await this.app.vault.read(file));
    if (!squad.steps.length) { new Notice(t("notice.noSteps")); return; }
    await this.runSquad(squad);
  }

  private async runSquad(squad: Squad) {
    const results: SquadStepResult[] = [];
    let prev = "";
    for (let i = 0; i < squad.steps.length; i++) {
      const step = squad.steps[i];
      const agent = this.resolveAgentRef(step.agentRef);
      if (!agent) { new Notice(t("notice.agentNotFound", { ref: step.agentRef, n: i + 1 })); return; }

      let approved = false;
      while (!approved) {
        this.office?.setActivity(agent.name, "working");
        const msg = prev
          ? `${step.instruction}\n\n--- Resultado do passo anterior (use como base) ---\n${prev}`
          : step.instruction;
        const out = await this.rawAgentCall(agent, msg, [], false, extractWikilinks(step.instruction), undefined, false, true);
        this.office?.setActivity(agent.name, "idle");
        if (out == null) return; // error/timeout already surfaced

        const decision = await new StepApprovalModal(this.app, i + 1, displayName(agent), out.trim()).openAndWait();
        if (decision.action === "cancel") { new Notice(t("notice.squadCancelled")); return; }
        if (decision.action === "redo") continue;
        prev = decision.text;
        results.push({ agent: displayName(agent), instruction: step.instruction, output: decision.text });
        approved = true;
      }
    }

    const now = new Date();
    const folder = (this.data.conversationsFolder ?? "").replace(/\/+$/, "").trim();
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try { await this.app.vault.createFolder(folder); } catch { /* exists */ }
    }
    const safe = (squad.name.replace(/[\\/:*?"<>|]/g, "-").slice(0, 40).trim()) || "squad";
    const path = (folder ? `${folder}/` : "") + `Squad ${safe} ${now.getTime()}.md`;
    const file = await this.app.vault.create(path, buildSquadRun(squad.name, results, now));
    await this.app.workspace.getLeaf(true).openFile(file as TFile);
    new Notice(t("notice.squadDone", { name: squad.name, count: results.length }));
  }

  // #6 — multi-agent brainstorm: selected agents discuss a topic in turns (auto), then a facilitator synthesizes.
  private async runBrainstorm() {
    const all = this.registry.all();
    if (all.length < 2) { new Notice(t("notice.needTwoAgents")); return; }
    const setup = await new BrainstormModal(this.app, all.map((a) => ({ name: a.name, label: displayName(a) }))).openAndWait();
    if (!setup) return;
    const cfg = this.data.providers.find((p) => p.id === this.data.activeProviderId);
    if (!cfg) { new Notice(t("notice.noProvider")); return; }

    const agents = setup.agentNames.map((n) => this.registry.get(n)).filter((a): a is Agent => !!a);
    const progress = new BrainstormProgressModal(this.app, setup.topic);
    progress.open();

    const transcript: Turn[] = [];
    let prevName: string | null = null;
    try {
      outer:
      for (let r = 0; r < setup.rounds; r++) {
        for (const agent of agents) {
          if (progress.stopped) break outer;
          // Each turn is isolated: an exception (e.g. a visual glitch) must never kill the whole run.
          try {
            this.office?.setActivity(agent.name, "working");
            try { if (prevName && prevName !== agent.name) this.office?.flashDelegation(prevName, agent.name); } catch { /* visual only */ }
            progress.status(t("bs.thinking", { agent: displayName(agent) }));
            // Race the turn against the Stop signal so Parar/closing interrupts immediately,
            // even while a slow provider call is still pending (the abandoned call is discarded).
            const reply = await Promise.race([
              this.rawAgentCall(agent, buildBrainstormTurnPrompt(setup.topic, transcript, displayName(agent)), [], false, [], 30000, true, true),
              progress.whenStopped().then(() => null),
            ]);
            if (progress.stopped) break outer;
            if (reply == null || !reply.trim()) {
              progress.status(t("bs.noReply", { agent: displayName(agent) }));
              await sleep(600);
              continue;
            }
            transcript.push({ agent: baseName(agent.filePath), text: reply.trim() });
            progress.addTurn(displayName(agent), reply.trim());
            prevName = agent.name;
            await sleep(1200);
          } catch (e) {
            console.error("[brainstorm] turn error", e);
            progress.status(t("bs.turnError", { agent: displayName(agent), err: (e as Error).message }));
          } finally {
            this.office?.setActivity(agent.name, "idle");
          }
        }
      }
    } finally {
      // Always clear office activity, even if something above threw or was stopped.
      for (const a of agents) this.office?.setActivity(a.name, "idle");
    }

    let synthesis = "";
    if (!progress.stopped && transcript.length) {
      progress.status(t("bs.synthesizing"));
      try {
        for await (const t of makeAdapter(this.cfgFor(true) ?? cfg).stream(
          [{ role: "user", content: buildFacilitatorPrompt(setup.topic, transcript) }],
          { system: FACILITATOR_SYSTEM, timeoutMs: 45000, maxTokens: this.data.maxTokens },
        )) synthesis += t;
      } catch (e) { progress.status(t("bs.synthFailed", { err: (e as Error).message })); }
    } else if (progress.stopped) {
      progress.status(t("bs.stoppedSaving"));
    }

    if (!transcript.length) {
      progress.status(t("bs.nothingToSave"));
      new Notice(t("notice.brainstormNoTurns"));
      return;
    }

    const folder = (this.data.conversationsFolder ?? "").replace(/\/+$/, "").trim();
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try { await this.app.vault.createFolder(folder); } catch { /* exists */ }
    }
    const safe = (setup.topic.slice(0, 40).replace(/[\\/:*?"<>|]/g, "-").trim()) || "brainstorm";
    const path = (folder ? `${folder}/` : "") + `Brainstorm ${safe} ${Date.now()}.md`;
    const note = buildBrainstormNote(setup.topic, transcript, synthesis, agents.map((a) => baseName(a.filePath)), new Date());
    const file = await this.app.vault.create(path, note);
    const verb = progress.stopped ? t("notice.verbStopped") : t("notice.verbDone");
    progress.status(t("bs.finished", { verb: progress.stopped ? t("bs.verbStopped") : t("bs.verbDone"), count: transcript.length }));
    progress.finish(() => void this.app.workspace.getLeaf(true).openFile(file as TFile));
    new Notice(t("notice.brainstormDone", { topic: setup.topic, verb, count: transcript.length }));
  }

  // Provider for a call: the light/cheap one (brainstorm/squad/routing) when set, else the active one.
  private cfgFor(light: boolean) {
    const id = light && this.data.lightProviderId ? this.data.lightProviderId : this.data.activeProviderId;
    return this.data.providers.find((p) => p.id === id)
      ?? this.data.providers.find((p) => p.id === this.data.activeProviderId);
  }

  // Low-level single call to an agent (with its vault context + optional delegation directive).
  private async rawAgentCall(agent: Agent, message: string, delegates: string[], agency = false, mentions: string[] = [], timeoutMs?: number, lean = false, light = false): Promise<string | null> {
    const cfg = this.cfgFor(light);
    if (!cfg) { new Notice(t("notice.noProvider")); return null; }
    // lean mode (brainstorm or global Economy): keep the agent's own connections/mentions but skip the
    // heavy context-folder + vault auto-consult so each call stays small (fewer tokens → fewer rate-limits).
    const slim = lean || this.data.economyMode;
    const notes = slim
      ? await resolveNotes(this.app, agent, mentions, [], message, false)
      : await resolveNotes(this.app, agent, mentions, this.data.contextFolders, message, this.data.autoConsultVault);
    const { system, messages } = buildPrompt(agent, [{ role: "user", content: message }], notes, delegates, agency);
    let reply = "";
    try { for await (const t of makeAdapter(cfg).stream(messages, { system, timeoutMs, maxTokens: this.data.maxTokens })) reply += t; }
    catch (e) { new Notice(`⚠️ ${(e as Error).message}`); return null; }
    return reply;
  }

  // Deterministic router: a short classification call picks the best-fit agent for the question.
  private async routePick(agent: Agent, question: string, candidates: Agent[]): Promise<Agent | null> {
    const cfg = this.cfgFor(true);
    if (!cfg) return null;
    const roster = candidates.map((c) => `- ${displayName(c)} — ${roleText(c) || c.room}`).join("\n");
    const system = "Você é um roteador que distribui perguntas para o agente certo de um time. Seja preciso.";
    const msg =
      `O usuário direcionou esta pergunta a "${displayName(agent)}".\n` +
      `Pergunta: "${question}"\n\nAgentes disponíveis (nome — especialidade):\n${roster}\n\n` +
      `Qual UM agente é o mais adequado para responder? Se "${displayName(agent)}" já for adequado, responda o nome dele. ` +
      `Responda APENAS com o nome exato do agente, nada mais.`;
    let reply = "";
    try { for await (const t of makeAdapter(cfg).stream([{ role: "user", content: msg }], { system, timeoutMs: 30000, maxTokens: 20 })) reply += t; }
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
    onStage?.(t("inline.analyzing", { agent: displayName(agent) }));

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
        onStage?.(t("inline.routed", { agent: displayName(agent), pick: displayName(pick) }));
      } else {
        onStage?.(t("inline.thinking", { agent: displayName(agent) }));
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

    write("> " + t("inline.thinkingBare"));
    const result = await this.runWithDelegation(agent, rest, (label) => write(`> ${label}`));
    if (!result) { write("> " + t("inline.noReplyConfig")); return; }

    const via = result.via ? `> 🤝 *${displayName(agent)} consultou [[${baseName(result.via.filePath)}]]:*\n>\n` : "";
    const quoted = (result.text || "(sem resposta)").split("\n").map((l) => `> ${l}`).join("\n");
    write(`${via}${quoted}`);
    new Notice(t("notice.agentReplied", {
      agent: displayName(agent),
      via: result.via ? t("notice.via", { name: displayName(result.via) }) : "",
    }));
  }

  // Agência: o agente propõe ações de escrita; cada uma passa por aprovação; executa e resume inline.
  private async actOnVault(editor: Editor) {
    const found = this.findMention(editor);
    if (!found) { new Notice(this.mentionHelp()); return; }
    const { lineIdx, agent, rest } = found;
    const startOff = editor.posToOffset({ line: lineIdx, ch: editor.getLine(lineIdx).length });
    let curLen = 0;
    const write = (body: string) => {
      const block = `\n\n> [!agent]+ ${agent.title}\n${body}\n`;
      editor.replaceRange(block, editor.offsetToPos(startOff), editor.offsetToPos(startOff + curLen));
      curLen = block.length;
    };
    write("> " + t("inline.planning"));
    this.office?.setActivity(agent.name, "working");
    const reply = await this.rawAgentCall(agent, rest, [], true);
    if (reply == null) { this.office?.setActivity(agent.name, "idle"); write("> " + t("inline.noReply")); return; }
    const actions = parseActions(reply);
    if (actions == null) { this.office?.setActivity(agent.name, "idle"); write("> " + t("inline.noActions")); return; }
    if (actions.length === 0) { this.office?.setActivity(agent.name, "idle"); write("> " + t("inline.noProposed")); return; }
    const results: ActionResult[] = [];
    const linktext = baseName(agent.filePath);
    for (let i = 0; i < actions.length; i++) {
      const act = actions[i];
      const finalPath = act.tool === "append_memory"
        ? agent.filePath
        : resolveTargetPath(act.path, this.data.agencyFolder, this.data.conversationsFolder);
      let cur: string | null = null;
      if (act.tool === "edit_note") {
        const f = this.app.vault.getAbstractFileByPath(finalPath);
        if (f instanceof TFile) cur = await this.app.vault.read(f);
      }
      const decision = await new ActionApprovalModal(this.app, i + 1, actions.length, displayName(agent), act, finalPath, cur).openAndWait();
      if (decision.action === "cancel") break;
      if (decision.action === "skip") { results.push({ status: "skipped", path: finalPath }); continue; }
      try {
        const r = await this.executeAction({ ...act, content: decision.content }, finalPath, linktext);
        results.push(r);
      } catch (e) {
        results.push({ status: "failed", path: finalPath, err: (e as Error).message });
      }
    }
    this.office?.setActivity(agent.name, "idle");
    write(buildAgencyReport(displayName(agent), results));
    new Notice(t("notice.actedOnVault", { agent: displayName(agent), count: results.length }));
  }

  // Executa uma ação aprovada. Edit em path inexistente → cria. Anexa rodapé de proveniência.
  private async executeAction(act: AgentAction, finalPath: string, linktext: string): Promise<ActionResult> {
    const footer = provenanceFooter(linktext, new Date());
    const existing = this.app.vault.getAbstractFileByPath(finalPath);
    if (act.tool === "append_memory") {
      if (!(existing instanceof TFile)) return { status: "failed", path: finalPath, err: "nota do agente não encontrada" };
      const stamp = new Date().toISOString().slice(0, 10);
      await this.app.vault.process(existing, (d) => addToMemory(d, `(${stamp}) ${act.content}`));
      return { status: "remembered", path: finalPath };
    }
    if (act.tool === "edit_note" && existing instanceof TFile) {
      await this.app.vault.process(existing, (d) =>
        act.mode === "replace" ? act.content + footer : stripTrailingProvenance(d) + "\n\n" + act.content + footer);
      return { status: "edited", path: finalPath, mode: act.mode };
    }
    // create_note, OU edit em path inexistente (fallback)
    const folder = finalPath.includes("/") ? finalPath.slice(0, finalPath.lastIndexOf("/")) : "";
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try { await this.app.vault.createFolder(folder); } catch { /* exists */ }
    }
    let path = finalPath;
    if (this.app.vault.getAbstractFileByPath(path)) {
      const dot = path.lastIndexOf(".");
      path = `${path.slice(0, dot)} ${Date.now()}${path.slice(dot)}`;
    }
    await this.app.vault.create(path, act.content + footer);
    return { status: "created", path };
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
    if (!spec) { new Notice(t("notice.noCanvasMap")); return; }

    const folder = (this.data.conversationsFolder ?? "").replace(/\/+$/, "").trim();
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try { await this.app.vault.createFolder(folder); } catch { /* exists */ }
    }
    const safe = (parsed.rest.slice(0, 40).replace(/[\\/:*?"<>|]/g, "-").trim()) || "mapa";
    let path = (folder ? `${folder}/` : "") + `${safe} (canvas).canvas`;
    if (this.app.vault.getAbstractFileByPath(path)) path = (folder ? `${folder}/` : "") + `${safe} ${Date.now()}.canvas`;

    const file = await this.app.vault.create(path, buildCanvas(spec));
    await this.app.workspace.getLeaf(true).openFile(file as TFile);
    new Notice(t("notice.canvasGenerated", { agent: displayName(parsed.agent) }));
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
      items.push({ label: f.basename, sublabel: t("ui.noteSub"), linktext: f.basename });
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
    if (!cfg) { new Notice(t("notice.noProvider")); return; }

    const notice = new Notice(t("notice.architectCreating"), 0);
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
    if (!note) { new Notice(t("notice.noAgentNote")); return; }

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
    new Notice(t("notice.agentCreatedAI", { name: safe }));
  }

  private async createAgent(o: NewAgentOpts) {
    const folder = (this.data.agentsFolder ?? "").replace(/\/+$/, "").trim();
    const safe = o.name.trim().replace(/[\\/:*?"<>|]/g, "-");
    if (!safe) { new Notice(t("notice.invalidName")); return; }
    if (folder && !this.app.vault.getAbstractFileByPath(folder)) {
      try { await this.app.vault.createFolder(folder); } catch { /* exists */ }
    }
    const path = folder ? `${folder}/${safe}.md` : `${safe}.md`;
    if (this.app.vault.getAbstractFileByPath(path)) { new Notice(t("notice.agentExists")); return; }

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
    new Notice(t("notice.agentCreated", { name: safe }));
  }

  private async openChatFor(agentName: string) {
    const agent = this.registry.get(agentName);
    if (!agent) return;
    const leaf: WorkspaceLeaf | null = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: CHAT_VIEW, active: true });
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view as ChatView;
    view.setAgent(agent);
  }

  private async crystallize(agent: Agent, session: ChatSession) {
    if (!session.messages.length) { new Notice(t("notice.nothingToCrystallize")); return; }
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
    new Notice(t("notice.crystallized", { path }));
  }
}

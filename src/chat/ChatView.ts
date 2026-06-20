import { ItemView, WorkspaceLeaf } from "obsidian";
import { Agent } from "../types";
import { ChatSession } from "./ChatSession";
import { accentOf, avatarGlyph, displayName } from "../office/avatar";

export const CHAT_VIEW = "lao-chat-view";

interface SuggestItem { label: string; sub: string; linktext: string; }

function baseName(filePath: string): string {
  return (filePath.split("/").pop() ?? filePath).replace(/\.md$/i, "");
}

export class ChatView extends ItemView {
  private session!: ChatSession;
  private agent!: Agent;
  private logEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private mentions: string[] = [];

  // inline @ suggester state
  private suggestEl: HTMLElement | null = null;
  private suggestItems: SuggestItem[] = [];
  private suggestIndex = 0;
  private mentionRange: { start: number; end: number } | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private makeSession: (agent: Agent) => ChatSession,
    private onWorking: (agentName: string, working: boolean) => void,
    private crystallize: (agent: Agent, session: ChatSession) => Promise<void>,
    private getAgents: () => Agent[],
  ) { super(leaf); }

  getViewType() { return CHAT_VIEW; }
  getDisplayText() { return this.agent ? `Chat · ${this.agent.title}` : "Agent Chat"; }
  getIcon() { return "message-square"; }

  setAgent(agent: Agent) {
    this.agent = agent;
    this.session = this.makeSession(agent);
    this.session.onStateChange((w) => this.onWorking(agent.name, w));
    this.renderShell();
  }

  async onOpen() { if (this.agent) this.renderShell(); }

  private renderShell() {
    const root = this.contentEl;
    root.empty();
    root.addClass("lao-chat");

    // Header
    const header = root.createDiv({ cls: "lao-chat-header" });
    const av = header.createDiv({ cls: "lao-chat-avatar" });
    av.style.setProperty("--accent", accentOf(this.agent));
    av.setText(avatarGlyph(this.agent));
    const htext = header.createDiv({ cls: "lao-chat-head-text" });
    htext.createDiv({ cls: "lao-chat-head-name", text: displayName(this.agent) });
    htext.createDiv({ cls: "lao-chat-head-room", text: `Sala · ${this.agent.room}` });

    this.logEl = root.createDiv({ cls: "lao-chat-log" });

    const bar = root.createDiv({ cls: "lao-chat-bar" });
    this.inputEl = bar.createEl("textarea", { cls: "lao-chat-input", attr: { rows: "1", placeholder: "Pergunte ao agente… (use @ para mencionar)" } });
    const send = bar.createEl("button", { cls: "mod-cta", text: "Enviar" });
    send.addEventListener("click", () => void this.handleSend());
    bar.createEl("button", { text: "Cristalizar" }).addEventListener("click", () => void this.crystallize(this.agent, this.session));

    this.inputEl.addEventListener("input", () => this.updateSuggest());
    this.inputEl.addEventListener("keydown", (e) => this.onInputKey(e));
    this.inputEl.addEventListener("blur", () => window.setTimeout(() => this.closeSuggest(), 120));
  }

  // ---------- inline @ suggester ----------

  private updateSuggest() {
    const caret = this.inputEl.selectionStart ?? this.inputEl.value.length;
    const before = this.inputEl.value.slice(0, caret);
    const m = before.match(/(?:^|\s)@([^\s@]{0,40})$/);
    if (!m) { this.closeSuggest(); return; }

    const query = m[1].toLowerCase();
    this.mentionRange = { start: caret - m[1].length - 1, end: caret };
    this.suggestItems = this.buildItems(query);
    if (!this.suggestItems.length) { this.closeSuggest(); return; }
    this.suggestIndex = 0;
    this.renderSuggest();
  }

  private buildItems(query: string): SuggestItem[] {
    const items: SuggestItem[] = [];
    for (const a of this.getAgents()) {
      if (a.name === this.agent?.name) continue;
      const hay = `${displayName(a)} ${a.name}`.toLowerCase();
      if (query && !hay.includes(query)) continue;
      items.push({ label: displayName(a), sub: `agente · ${a.room}`, linktext: baseName(a.filePath) });
      if (items.length >= 6) break;
    }
    for (const f of this.app.vault.getMarkdownFiles()) {
      if (items.length >= 12) break;
      if (query && !f.basename.toLowerCase().includes(query)) continue;
      if (items.some((i) => i.linktext === f.basename)) continue;
      items.push({ label: f.basename, sub: "nota", linktext: f.basename });
    }
    return items;
  }

  private renderSuggest() {
    if (!this.suggestEl) {
      const bar = this.inputEl.parentElement!;
      this.suggestEl = bar.createDiv({ cls: "lao-suggest" });
    }
    this.suggestEl.empty();
    this.suggestItems.forEach((it, i) => {
      const row = this.suggestEl!.createDiv({ cls: "lao-suggest-item" + (i === this.suggestIndex ? " active" : "") });
      row.createSpan({ cls: "lao-suggest-label", text: it.label });
      row.createSpan({ cls: "lao-suggest-sub", text: it.sub });
      row.addEventListener("mousedown", (e) => { e.preventDefault(); this.chooseSuggest(i); });
    });
  }

  private onInputKey(e: KeyboardEvent) {
    if (this.suggestEl) {
      if (e.key === "ArrowDown") { e.preventDefault(); this.suggestIndex = (this.suggestIndex + 1) % this.suggestItems.length; this.renderSuggest(); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); this.suggestIndex = (this.suggestIndex - 1 + this.suggestItems.length) % this.suggestItems.length; this.renderSuggest(); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); this.chooseSuggest(this.suggestIndex); return; }
      if (e.key === "Escape") { e.preventDefault(); this.closeSuggest(); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void this.handleSend(); }
  }

  private chooseSuggest(i: number) {
    const it = this.suggestItems[i];
    if (!it || !this.mentionRange) { this.closeSuggest(); return; }
    const v = this.inputEl.value;
    const insert = `@${it.label} `;
    this.inputEl.value = v.slice(0, this.mentionRange.start) + insert + v.slice(this.mentionRange.end);
    const caret = this.mentionRange.start + insert.length;
    this.inputEl.setSelectionRange(caret, caret);
    if (!this.mentions.includes(it.linktext)) this.mentions.push(it.linktext);
    this.closeSuggest();
    this.inputEl.focus();
  }

  private closeSuggest() {
    this.suggestEl?.remove();
    this.suggestEl = null;
    this.suggestItems = [];
    this.mentionRange = null;
  }

  // ---------- send ----------

  private addBubble(role: "user" | "assistant", text: string): HTMLElement {
    const el = this.logEl.createDiv({ cls: `lao-msg ${role}`, text });
    this.logEl.scrollTop = this.logEl.scrollHeight;
    return el;
  }

  private async handleSend() {
    this.closeSuggest();
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.inputEl.value = "";
    this.addBubble("user", text);
    const replyEl = this.addBubble("assistant", "");
    replyEl.addClass("streaming");
    const off = this.session.onToken((t) => { replyEl.textContent += t; this.logEl.scrollTop = this.logEl.scrollHeight; });
    const mentions = this.mentions; this.mentions = [];
    try { await this.session.send(text, mentions); }
    catch (e) { replyEl.textContent = `⚠️ ${(e as Error).message}`; }
    finally { off(); replyEl.removeClass("streaming"); }
  }
}

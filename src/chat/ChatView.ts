import { ItemView, WorkspaceLeaf, Notice, TFile } from "obsidian";
import { Agent } from "../types";
import { ChatSession } from "./ChatSession";
import { MentionModal } from "./MentionModal";

export const CHAT_VIEW = "lao-chat-view";

export class ChatView extends ItemView {
  private session!: ChatSession;
  private agent!: Agent;
  private logEl!: HTMLElement;
  private inputEl!: HTMLTextAreaElement;
  private mentions: string[] = [];

  constructor(
    leaf: WorkspaceLeaf,
    private makeSession: (agent: Agent) => ChatSession,
    private onWorking: (agentName: string, working: boolean) => void,
    private crystallize: (agent: Agent, session: ChatSession) => Promise<void>,
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
    this.logEl = root.createDiv({ cls: "lao-chat-log" });

    const bar = root.createDiv({ cls: "lao-chat-bar" });
    bar.createEl("button", { text: "@" }).addEventListener("click", () => {
      new MentionModal(this.app, (f: TFile) => { this.mentions.push(f.basename); new Notice(`@${f.basename}`); }).open();
    });
    this.inputEl = bar.createEl("textarea", { cls: "lao-chat-input", attr: { rows: "1", placeholder: "Pergunte ao agente…" } });
    bar.createEl("button", { text: "Enviar" }).addEventListener("click", () => void this.handleSend());
    bar.createEl("button", { text: "Cristalizar" }).addEventListener("click", () => void this.crystallize(this.agent, this.session));

    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void this.handleSend(); }
    });
  }

  private addBubble(role: "user" | "assistant", text: string): HTMLElement {
    const el = this.logEl.createDiv({ cls: `lao-msg ${role}`, text });
    this.logEl.scrollTop = this.logEl.scrollHeight;
    return el;
  }

  private async handleSend() {
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.inputEl.value = "";
    this.addBubble("user", text);
    const replyEl = this.addBubble("assistant", "");
    this.session.onToken((t) => { replyEl.textContent += t; this.logEl.scrollTop = this.logEl.scrollHeight; });
    const mentions = this.mentions; this.mentions = [];
    try { await this.session.send(text, mentions); }
    catch (e) { replyEl.textContent = `⚠️ ${(e as Error).message}`; }
  }
}

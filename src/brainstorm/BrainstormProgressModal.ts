import { App, Modal } from "obsidian";

/** Live view of a running brainstorm: turns stream in; Stop (or closing) cancels immediately. */
export class BrainstormProgressModal extends Modal {
  stopped = false;
  private log!: HTMLElement;
  private stopWaiters: (() => void)[] = [];

  constructor(app: App, private topic: string) { super(app); }

  /** Resolves as soon as the user stops (button) or closes the modal. */
  whenStopped(): Promise<void> {
    return new Promise((res) => { if (this.stopped) res(); else this.stopWaiters.push(res); });
  }

  private triggerStop() {
    if (this.stopped) return;
    this.stopped = true;
    const waiters = this.stopWaiters;
    this.stopWaiters = [];
    for (const w of waiters) w();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `🧠 Brainstorm: ${this.topic}` });
    this.log = contentEl.createDiv({ cls: "lao-bs-log" });
    const bar = contentEl.createDiv({ cls: "lao-step-actions" });
    bar.createEl("button", { text: "⏹ Parar" }).addEventListener("click", () => {
      this.status("⏹ Parando…");
      this.triggerStop();
    });
  }

  addTurn(agent: string, text: string) {
    const row = this.log.createDiv({ cls: "lao-bs-turn" });
    row.createEl("strong", { text: `${agent}: ` });
    row.createSpan({ text });
    this.log.scrollTop = this.log.scrollHeight;
  }

  status(msg: string) {
    this.log.createDiv({ cls: "lao-bs-status setting-item-description", text: msg });
    this.log.scrollTop = this.log.scrollHeight;
  }

  finish(open: () => void) {
    const bar = this.contentEl.createDiv({ cls: "lao-step-actions" });
    bar.createEl("button", { cls: "mod-cta", text: "Abrir nota" }).addEventListener("click", () => { open(); this.close(); });
    bar.createEl("button", { text: "Fechar" }).addEventListener("click", () => this.close());
  }

  onClose() { this.triggerStop(); }
}

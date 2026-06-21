import { App, Modal } from "obsidian";
import { t as tr } from "../i18n";

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
    contentEl.createEl("h3", { text: tr("bsp.title", { topic: this.topic }) });
    this.log = contentEl.createDiv({ cls: "lao-bs-log" });
    const bar = contentEl.createDiv({ cls: "lao-step-actions" });
    bar.createEl("button", { text: tr("bsp.stop") }).addEventListener("click", () => {
      this.status(tr("bsp.stopping"));
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
    bar.createEl("button", { cls: "mod-cta", text: tr("bsp.openNote") }).addEventListener("click", () => { open(); this.close(); });
    bar.createEl("button", { text: tr("bsp.close") }).addEventListener("click", () => this.close());
  }

  onClose() { this.triggerStop(); }
}

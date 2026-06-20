import { App, Modal } from "obsidian";

export type StepDecision = { action: "approve" | "redo" | "cancel"; text: string };

/** Shows a step's output for review/edit, then resolves with the user's decision. */
export class StepApprovalModal extends Modal {
  private resolver!: (d: StepDecision) => void;
  private settled = false;
  private result: Promise<StepDecision>;

  constructor(app: App, private stepNum: number, private agentName: string, private output: string) {
    super(app);
    this.result = new Promise((res) => (this.resolver = res));
  }

  openAndWait(): Promise<StepDecision> { this.open(); return this.result; }

  private settle(d: StepDecision) {
    if (this.settled) return;
    this.settled = true;
    this.resolver(d);
    this.close();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: `Passo ${this.stepNum} · ${this.agentName}` });
    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "Revise e edite se quiser. “Aprovar” usa o texto abaixo como entrada do próximo passo.",
    });
    const ta = contentEl.createEl("textarea", { cls: "lao-step-output" });
    ta.value = this.output;
    ta.rows = 14;

    const bar = contentEl.createDiv({ cls: "lao-step-actions" });
    bar.createEl("button", { cls: "mod-cta", text: "✓ Aprovar e continuar" })
      .addEventListener("click", () => this.settle({ action: "approve", text: ta.value }));
    bar.createEl("button", { text: "↻ Refazer" })
      .addEventListener("click", () => this.settle({ action: "redo", text: "" }));
    bar.createEl("button", { text: "✕ Cancelar" })
      .addEventListener("click", () => this.settle({ action: "cancel", text: "" }));
  }

  onClose() {
    this.contentEl.empty();
    this.settle({ action: "cancel", text: "" });
  }
}

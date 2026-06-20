import { App, Modal } from "obsidian";
import { AgentAction } from "../types";
import { diffLines } from "./diffLines";

export type ActionDecision = { action: "approve" | "skip" | "cancel"; content: string };

/** Shows one proposed vault-write action for review (with diff preview on edit). */
export class ActionApprovalModal extends Modal {
  private resolver!: (d: ActionDecision) => void;
  private settled = false;
  private result: Promise<ActionDecision>;

  constructor(
    app: App,
    private idx: number,
    private total: number,
    private agentName: string,
    private act: AgentAction,
    private finalPath: string,
    private currentContent: string | null, // existing note content for edit diff, null for create
  ) {
    super(app);
    this.result = new Promise((res) => (this.resolver = res));
  }

  openAndWait(): Promise<ActionDecision> { this.open(); return this.result; }

  private settle(d: ActionDecision) {
    if (this.settled) return;
    this.settled = true;
    this.resolver(d);
    this.close();
  }

  onOpen() {
    const { contentEl } = this;
    const tool = this.act.tool;

    contentEl.createEl("h3", { text: `Ação ${this.idx} de ${this.total} · ${this.agentName}` });

    let badgeText: string, badgeCls: string;
    if (tool === "create_note") { badgeText = "criar nota"; badgeCls = "is-create"; }
    else if (tool === "edit_note") { badgeText = `editar nota (${this.act.mode})`; badgeCls = "is-edit"; }
    else { badgeText = "anotar memória"; badgeCls = "is-memory"; }
    const badge = contentEl.createDiv({ cls: `lao-tool-badge ${badgeCls}` });
    badge.setText(badgeText);

    const pathLabel = tool === "append_memory" ? `Memória do agente: ${this.finalPath}` : `Caminho: ${this.finalPath}`;
    contentEl.createEl("p", { cls: "setting-item-description", text: pathLabel });

    if (tool === "edit_note" && this.currentContent != null) {
      const newWhole = (this.act as any).mode === "replace"
        ? this.act.content
        : this.currentContent + "\n\n" + this.act.content;
      const diff = contentEl.createDiv({ cls: "lao-diff" });
      for (const seg of diffLines(this.currentContent, newWhole)) {
        const row = diff.createDiv({ cls: `lao-diff-row is-${seg.type}` });
        row.setText((seg.type === "add" ? "+ " : seg.type === "del" ? "- " : "  ") + seg.text);
      }
    }

    contentEl.createEl("p", { cls: "setting-item-description", text: "Conteúdo a gravar (editável):" });
    const ta = contentEl.createEl("textarea", { cls: "lao-step-output" });
    ta.value = this.act.content;
    ta.rows = 12;

    const bar = contentEl.createDiv({ cls: "lao-step-actions" });
    bar.createEl("button", { cls: "mod-cta", text: "✓ Aprovar e executar" })
      .addEventListener("click", () => this.settle({ action: "approve", content: ta.value }));
    bar.createEl("button", { text: "⏭ Pular" })
      .addEventListener("click", () => this.settle({ action: "skip", content: "" }));
    bar.createEl("button", { text: "✕ Cancelar" })
      .addEventListener("click", () => this.settle({ action: "cancel", content: "" }));
  }

  onClose() {
    this.contentEl.empty();
    this.settle({ action: "cancel", content: "" });
  }
}

import { App, Modal } from "obsidian";
import { AgentAction } from "../types";
import { diffLines } from "./diffLines";
import { t as tr } from "../i18n";

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

    contentEl.createEl("h3", { text: tr("aa.title", { idx: this.idx, total: this.total, agent: this.agentName }) });

    let badgeText: string, badgeCls: string;
    if (tool === "create_note") { badgeText = tr("aa.badge.create"); badgeCls = "is-create"; }
    else if (tool === "edit_note") { badgeText = tr("aa.badge.edit", { mode: this.act.mode }); badgeCls = "is-edit"; }
    else { badgeText = tr("aa.badge.memory"); badgeCls = "is-memory"; }
    const badge = contentEl.createDiv({ cls: `lao-tool-badge ${badgeCls}` });
    badge.setText(badgeText);

    const pathLabel = tool === "append_memory" ? tr("aa.pathMemory", { path: this.finalPath }) : tr("aa.path", { path: this.finalPath });
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

    contentEl.createEl("p", { cls: "setting-item-description", text: tr("aa.contentLabel") });
    const ta = contentEl.createEl("textarea", { cls: "lao-step-output" });
    ta.value = this.act.content;
    ta.rows = 12;

    const bar = contentEl.createDiv({ cls: "lao-step-actions" });
    bar.createEl("button", { cls: "mod-cta", text: tr("aa.approve") })
      .addEventListener("click", () => this.settle({ action: "approve", content: ta.value }));
    bar.createEl("button", { text: tr("aa.skip") })
      .addEventListener("click", () => this.settle({ action: "skip", content: "" }));
    bar.createEl("button", { text: tr("aa.cancel") })
      .addEventListener("click", () => this.settle({ action: "cancel", content: "" }));
  }

  onClose() {
    this.contentEl.empty();
    this.settle({ action: "cancel", content: "" });
  }
}

import { App, Modal, Notice } from "obsidian";

export type BrainstormSetup = { agentNames: string[]; topic: string; rounds: number };

/** Pick 2+ agents, a topic and a round count for a group brainstorm. */
export class BrainstormModal extends Modal {
  private resolver!: (s: BrainstormSetup | null) => void;
  private settled = false;
  private result: Promise<BrainstormSetup | null>;
  private selected = new Set<string>();

  constructor(app: App, private agents: { name: string; label: string }[]) {
    super(app);
    this.result = new Promise((res) => (this.resolver = res));
  }

  openAndWait(): Promise<BrainstormSetup | null> { this.open(); return this.result; }

  private settle(s: BrainstormSetup | null) {
    if (this.settled) return;
    this.settled = true;
    this.resolver(s);
    this.close();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "🧠 Brainstorm multi-agente" });
    contentEl.createEl("p", { cls: "setting-item-description", text: "Escolha 2+ agentes, o tema e quantas rodadas." });

    const list = contentEl.createDiv({ cls: "lao-bs-agents" });
    for (const a of this.agents) {
      const row = list.createEl("label", { cls: "lao-bs-agent" });
      const cb = row.createEl("input", { attr: { type: "checkbox" } });
      cb.addEventListener("change", () => { if (cb.checked) this.selected.add(a.name); else this.selected.delete(a.name); });
      row.createSpan({ text: " " + a.label });
    }

    contentEl.createEl("p", { cls: "setting-item-description", text: "Tema:" });
    const topic = contentEl.createEl("textarea", { cls: "lao-step-output" });
    topic.rows = 3;

    const roundsRow = contentEl.createDiv({ cls: "lao-bs-rounds" });
    roundsRow.createSpan({ text: "Rodadas: " });
    const rounds = roundsRow.createEl("input", { attr: { type: "number", min: "1", max: "5", value: "3" } });

    const bar = contentEl.createDiv({ cls: "lao-step-actions" });
    bar.createEl("button", { cls: "mod-cta", text: "Iniciar" }).addEventListener("click", () => {
      if (this.selected.size < 2) { new Notice("Escolha pelo menos 2 agentes."); return; }
      const t = topic.value.trim();
      if (!t) { topic.focus(); return; }
      this.settle({ agentNames: [...this.selected], topic: t, rounds: Math.max(1, Math.min(5, Number(rounds.value) || 3)) });
    });
    bar.createEl("button", { text: "Cancelar" }).addEventListener("click", () => this.settle(null));
  }

  onClose() { this.contentEl.empty(); this.settle(null); }
}

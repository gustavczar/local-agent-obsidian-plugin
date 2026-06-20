import { App, Modal, Setting, Notice } from "obsidian";

export type AgentTemplate = "elite" | "min";
export interface NewAgentOpts { name: string; title: string; room: string; icon: string; color: string; template: AgentTemplate; }

export class AddAgentModal extends Modal {
  private opts: NewAgentOpts = { name: "", title: "", room: "", icon: "", color: "", template: "elite" };

  constructor(
    app: App,
    private rooms: string[],
    private onCreate: (o: NewAgentOpts) => void,
    private onGenerateWithAI?: (description: string) => void,
  ) { super(app); }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Novo agente" });
    contentEl.createEl("p", {
      text: "Gera uma nota inicial na pasta de agentes. Edite livremente depois — é só markdown.",
      cls: "setting-item-description",
    });

    new Setting(contentEl).setName("Nome").setDesc("Id único — vira o nome do arquivo.")
      .addText((t) => t.setPlaceholder("nexo").onChange((v) => (this.opts.name = v)));

    new Setting(contentEl).setName("Título").setDesc("Ex: Nexo — A Lente da Decisão")
      .addText((t) => t.setPlaceholder("Nexo — A Lente da Decisão").onChange((v) => (this.opts.title = v)));

    new Setting(contentEl).setName("Sala").setDesc(this.rooms.length ? `Nova ou existente: ${this.rooms.join(", ")}` : "Categoria/sala (nova).")
      .addText((t) => t.setPlaceholder("estrategia").onChange((v) => (this.opts.room = v)));

    new Setting(contentEl).setName("Ícone").setDesc("Emoji do avatar (opcional).")
      .addText((t) => t.setPlaceholder("🧠").onChange((v) => (this.opts.icon = v)));

    new Setting(contentEl).setName("Cor").setDesc("Cor do avatar, ex: #a78bfa (opcional).")
      .addText((t) => t.setPlaceholder("#a78bfa").onChange((v) => (this.opts.color = v)));

    new Setting(contentEl).setName("Método").setDesc("Estrutura sugerida do agente (você edita livremente depois).")
      .addDropdown((d) => d
        .addOption("elite", "Método Elite (sugerido)")
        .addOption("min", "Mínimo (em branco)")
        .setValue(this.opts.template)
        .onChange((v) => (this.opts.template = v as AgentTemplate)));

    new Setting(contentEl).addButton((b) =>
      b.setButtonText("Criar agente").setCta().onClick(() => {
        if (!this.opts.name.trim()) { new Notice("Nome é obrigatório."); return; }
        this.onCreate(this.opts);
        this.close();
      }),
    );

    if (this.onGenerateWithAI) {
      contentEl.createEl("hr");
      contentEl.createEl("h4", { text: "✨ Ou: descreva e deixe a IA criar" });
      let desc = "";
      new Setting(contentEl)
        .setName("Descrição")
        .setDesc("Ex: um designer que cria imagens minimalistas para Instagram, voz seca e direta.")
        .addTextArea((t) => { t.setPlaceholder("Descreva o agente em linguagem natural…").onChange((v) => (desc = v)); t.inputEl.rows = 3; });
      new Setting(contentEl).addButton((b) =>
        b.setButtonText("✨ Gerar com IA").onClick(() => {
          if (!desc.trim()) { new Notice("Descreva o agente primeiro."); return; }
          this.onGenerateWithAI!(desc.trim());
          this.close();
        }),
      );
    }
  }

  onClose() { this.contentEl.empty(); }
}

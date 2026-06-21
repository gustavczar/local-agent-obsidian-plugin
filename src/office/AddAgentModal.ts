import { App, Modal, Setting, Notice } from "obsidian";
import { t as tr } from "../i18n";

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
    contentEl.createEl("h3", { text: tr("add.title") });
    contentEl.createEl("p", {
      text: tr("add.intro"),
      cls: "setting-item-description",
    });

    new Setting(contentEl).setName(tr("add.name.name")).setDesc(tr("add.name.desc"))
      .addText((t) => t.setPlaceholder("nexo").onChange((v) => (this.opts.name = v)));

    new Setting(contentEl).setName(tr("add.title.name")).setDesc(tr("add.title.desc"))
      .addText((t) => t.setPlaceholder(tr("add.title.ph")).onChange((v) => (this.opts.title = v)));

    new Setting(contentEl).setName(tr("add.room.name")).setDesc(this.rooms.length ? tr("add.room.descNew", { list: this.rooms.join(", ") }) : tr("add.room.descEmpty"))
      .addText((t) => t.setPlaceholder("estrategia").onChange((v) => (this.opts.room = v)));

    new Setting(contentEl).setName(tr("add.icon.name")).setDesc(tr("add.icon.desc"))
      .addText((t) => t.setPlaceholder("🧠").onChange((v) => (this.opts.icon = v)));

    new Setting(contentEl).setName(tr("add.color.name")).setDesc(tr("add.color.desc"))
      .addText((t) => t.setPlaceholder("#a78bfa").onChange((v) => (this.opts.color = v)));

    new Setting(contentEl).setName(tr("add.method.name")).setDesc(tr("add.method.desc"))
      .addDropdown((d) => d
        .addOption("elite", tr("add.method.elite"))
        .addOption("min", tr("add.method.min"))
        .setValue(this.opts.template)
        .onChange((v) => (this.opts.template = v as AgentTemplate)));

    new Setting(contentEl).addButton((b) =>
      b.setButtonText(tr("add.create")).setCta().onClick(() => {
        if (!this.opts.name.trim()) { new Notice(tr("add.nameRequired")); return; }
        this.onCreate(this.opts);
        this.close();
      }),
    );

    if (this.onGenerateWithAI) {
      contentEl.createEl("hr");
      contentEl.createEl("h4", { text: tr("add.aiHeader") });
      let desc = "";
      new Setting(contentEl)
        .setName(tr("add.descLabel"))
        .setDesc(tr("add.descDesc"))
        .addTextArea((t) => { t.setPlaceholder(tr("add.descPh")).onChange((v) => (desc = v)); t.inputEl.rows = 3; });
      new Setting(contentEl).addButton((b) =>
        b.setButtonText(tr("add.genAI")).onClick(() => {
          if (!desc.trim()) { new Notice(tr("add.describeFirst")); return; }
          this.onGenerateWithAI!(desc.trim());
          this.close();
        }),
      );
    }
  }

  onClose() { this.contentEl.empty(); }
}

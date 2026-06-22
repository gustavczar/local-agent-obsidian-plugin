import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import { OPENAI_COMPAT_PRESETS } from "../providers/ProviderAdapter";
import type LocalAgentOfficePlugin from "../main";
import { t as tr, setLanguage, LangPref } from "../i18n";
import { ProviderKind } from "../types";

export class SettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: LocalAgentOfficePlugin) { super(app, plugin); }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const data = this.plugin.data;

    new Setting(containerEl)
      .setName(tr("set.language.name"))
      .setDesc(tr("set.language.desc"))
      .addDropdown((d) => d
        .addOption("auto", tr("set.language.auto"))
        .addOption("en", "English")
        .addOption("pt", "Português")
        .setValue(data.language)
        .onChange(async (v) => {
          data.language = v as LangPref;
          setLanguage(data.language);
          await this.plugin.persist();
          this.display();
        }));

    new Setting(containerEl)
      .setName(tr("set.agentsFolder.name"))
      .setDesc(tr("set.agentsFolder.desc"))
      .addText((t) => t.setValue(data.agentsFolder).onChange(async (v) => {
        data.agentsFolder = v.trim();
        this.plugin.registry.setFolder(data.agentsFolder);
        await this.plugin.persist();
        await this.plugin.registry.load();
        this.display();
      }));

    const folderPath = (data.agentsFolder ?? "").replace(/\/+$/, "").trim();
    const exists = !!folderPath && !!this.app.vault.getAbstractFileByPath(folderPath);
    const count = this.plugin.registry.all().length;
    const status = containerEl.createDiv({ cls: "setting-item-description lao-folder-status" });
    status.setText(
      exists
        ? tr("set.folderFound", { count })
        : tr("set.folderMissing", { path: folderPath || tr("set.folderEmpty") }),
    );

    new Setting(containerEl)
      .setName(tr("set.conversationsFolder.name"))
      .setDesc(tr("set.conversationsFolder.desc"))
      .addText((t) => t.setPlaceholder("Conversas Local Agent").setValue(data.conversationsFolder)
        .onChange(async (v) => { data.conversationsFolder = v.trim(); await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName(tr("set.agencyFolder.name"))
      .setDesc(tr("set.agencyFolder.desc"))
      .addText((t) => t.setPlaceholder(tr("set.agencyFolder.ph")).setValue(this.plugin.data.agencyFolder)
        .onChange(async (v) => { this.plugin.data.agencyFolder = v.trim(); await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName(tr("set.contextFolders.name"))
      .setDesc(tr("set.contextFolders.desc"))
      .addTextArea((t) => {
        t.setPlaceholder("03. Recursos\n05. Inbox").setValue(data.contextFolders.join("\n"))
          .onChange(async (v) => { data.contextFolders = v.split("\n").map((s) => s.trim()).filter(Boolean); await this.plugin.persist(); });
        t.inputEl.rows = 3;
      });

    new Setting(containerEl)
      .setName(tr("set.autoConsult.name"))
      .setDesc(tr("set.autoConsult.desc"))
      .addToggle((t) => t.setValue(data.autoConsultVault).onChange(async (v) => { data.autoConsultVault = v; await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName(tr("set.autoDelegate.name"))
      .setDesc(tr("set.autoDelegate.desc"))
      .addToggle((t) => t.setValue(data.autoDelegate).onChange(async (v) => { data.autoDelegate = v; await this.plugin.persist(); }));

    new Setting(containerEl).setName(tr("set.providers")).setHeading();

    data.providers.forEach((p, i) => {
      new Setting(containerEl)
        .setName(p.id || `provider ${i + 1}`)
        .addDropdown((d) => d.addOption("anthropic", "Anthropic").addOption("openai-compat", "OpenAI-compatible")
          .setValue(p.kind).onChange(async (v) => { p.kind = v as ProviderKind; await this.plugin.persist(); this.display(); }))
        .addText((t) => t.setPlaceholder(tr("set.modelPh")).setValue(p.model).onChange(async (v) => { p.model = v; await this.plugin.persist(); }))
        .addText((t) => { t.setPlaceholder(tr("set.apiKeyPh")).setValue(p.apiKey ? "•••• SET" : "").onChange(async (v) => { p.apiKey = v; await this.plugin.persist(); }); t.inputEl.type = "password"; })
        .addExtraButton((b) => b.setIcon("trash").onClick(async () => { data.providers.splice(i, 1); await this.plugin.persist(); this.display(); }));

      if (p.kind === "openai-compat") {
        new Setting(containerEl).setName(tr("set.baseUrl")).setDesc(tr("set.presets", { list: Object.keys(OPENAI_COMPAT_PRESETS).join(", ") }))
          .addText((t) => t.setPlaceholder("https://api.deepseek.com/v1").setValue(p.baseURL ?? "")
            .onChange(async (v) => { p.baseURL = OPENAI_COMPAT_PRESETS[v.trim()] ?? v.trim(); await this.plugin.persist(); }));
      }
    });

    new Setting(containerEl).addButton((b) => b.setButtonText(tr("set.addProvider")).onClick(async () => {
      data.providers.push({ id: `provider-${data.providers.length + 1}`, kind: "openai-compat", model: "", apiKey: "" });
      await this.plugin.persist(); this.display();
    }));

    new Setting(containerEl).setName(tr("set.activeProvider"))
      .addDropdown((d) => { for (const p of data.providers) d.addOption(p.id, p.id); d.setValue(data.activeProviderId)
        .onChange(async (v) => { data.activeProviderId = v; await this.plugin.persist(); }); });

    new Setting(containerEl).setName(tr("set.economy")).setHeading();

    new Setting(containerEl)
      .setName(tr("set.economyMode.name"))
      .setDesc(tr("set.economyMode.desc"))
      .addToggle((t) => t.setValue(data.economyMode).onChange(async (v) => { data.economyMode = v; await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName(tr("set.maxTokens.name"))
      .setDesc(tr("set.maxTokens.desc"))
      .addText((t) => t.setPlaceholder("0").setValue(String(data.maxTokens))
        .onChange(async (v) => { data.maxTokens = Math.max(0, Number(v) || 0); await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName(tr("set.lightProvider.name"))
      .setDesc(tr("set.lightProvider.desc"))
      .addDropdown((d) => {
        d.addOption("", tr("set.lightProvider.useActive"));
        for (const p of data.providers) d.addOption(p.id, p.id);
        d.setValue(data.lightProviderId).onChange(async (v) => { data.lightProviderId = v; await this.plugin.persist(); });
      });

    new Setting(containerEl).setDesc(tr("set.keysWarning"))
      .addButton((b) => b.setButtonText(tr("set.reloadAgents")).onClick(async () => { await this.plugin.registry.load(); new Notice(tr("notice.agentsReloaded")); }));
  }
}

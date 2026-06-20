import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import { OPENAI_COMPAT_PRESETS } from "../providers/ProviderAdapter";
import type LocalAgentOfficePlugin from "../main";

export class SettingsTab extends PluginSettingTab {
  constructor(app: App, private plugin: LocalAgentOfficePlugin) { super(app, plugin); }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const data = this.plugin.data;

    new Setting(containerEl)
      .setName("Pasta de agentes")
      .setDesc("Pasta varrida em busca de .md de agentes.")
      .addText((t) => t.setValue(data.agentsFolder).onChange(async (v) => { data.agentsFolder = v.trim(); await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName("Pasta de conversas")
      .setDesc("Onde as conversas cristalizadas são salvas (criada se não existir).")
      .addText((t) => t.setPlaceholder("Conversas Local Agent").setValue(data.conversationsFolder)
        .onChange(async (v) => { data.conversationsFolder = v.trim(); await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName("Pastas de contexto")
      .setDesc("Uma pasta por linha. Todo agente consulta as notas dessas pastas (até 12 notas, truncadas).")
      .addTextArea((t) => {
        t.setPlaceholder("03. Recursos\n05. Inbox").setValue(data.contextFolders.join("\n"))
          .onChange(async (v) => { data.contextFolders = v.split("\n").map((s) => s.trim()).filter(Boolean); await this.plugin.persist(); });
        t.inputEl.rows = 3;
      });

    new Setting(containerEl).setName("Providers").setHeading();

    data.providers.forEach((p, i) => {
      new Setting(containerEl)
        .setName(p.id || `provider ${i + 1}`)
        .addDropdown((d) => d.addOption("anthropic", "Anthropic").addOption("openai-compat", "OpenAI-compatible")
          .setValue(p.kind).onChange(async (v) => { p.kind = v as any; await this.plugin.persist(); this.display(); }))
        .addText((t) => t.setPlaceholder("model").setValue(p.model).onChange(async (v) => { p.model = v; await this.plugin.persist(); }))
        .addText((t) => { t.setPlaceholder("API key").setValue(p.apiKey ? "•••• SET" : "").onChange(async (v) => { p.apiKey = v; await this.plugin.persist(); }); t.inputEl.type = "password"; })
        .addExtraButton((b) => b.setIcon("trash").onClick(async () => { data.providers.splice(i, 1); await this.plugin.persist(); this.display(); }));

      if (p.kind === "openai-compat") {
        new Setting(containerEl).setName("↳ Base URL").setDesc(`Presets: ${Object.keys(OPENAI_COMPAT_PRESETS).join(", ")}`)
          .addText((t) => t.setPlaceholder("https://api.deepseek.com/v1").setValue(p.baseURL ?? "")
            .onChange(async (v) => { p.baseURL = OPENAI_COMPAT_PRESETS[v.trim()] ?? v.trim(); await this.plugin.persist(); }));
      }
    });

    new Setting(containerEl).addButton((b) => b.setButtonText("+ Add provider").onClick(async () => {
      data.providers.push({ id: `provider-${data.providers.length + 1}`, kind: "openai-compat", model: "", apiKey: "" });
      await this.plugin.persist(); this.display();
    }));

    new Setting(containerEl).setName("Provider ativo")
      .addDropdown((d) => { for (const p of data.providers) d.addOption(p.id, p.id); d.setValue(data.activeProviderId)
        .onChange(async (v) => { data.activeProviderId = v; await this.plugin.persist(); }); });

    new Setting(containerEl).setDesc("⚠️ As chaves ficam em data.json dentro do vault. Não inclua esse arquivo em backups públicos.")
      .addButton((b) => b.setButtonText("Recarregar agentes").onClick(async () => { await this.plugin.registry.load(); new Notice("Agentes recarregados"); }));
  }
}

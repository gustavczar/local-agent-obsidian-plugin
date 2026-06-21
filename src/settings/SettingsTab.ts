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
      .setDesc("Pasta varrida em busca de .md de agentes. Mantenha seus agentes aqui para não ficarem soltos.")
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
        ? `✓ Pasta encontrada — ${count} agente(s).`
        : `⚠ A pasta "${folderPath || "(vazia)"}" ainda não existe. Crie um agente (cria a pasta) ou ajuste o caminho.`,
    );

    new Setting(containerEl)
      .setName("Pasta de conversas")
      .setDesc("Onde as conversas cristalizadas são salvas (criada se não existir).")
      .addText((t) => t.setPlaceholder("Conversas Local Agent").setValue(data.conversationsFolder)
        .onChange(async (v) => { data.conversationsFolder = v.trim(); await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName("Pasta de saída da agência")
      .setDesc("Onde os agentes criam/editam notas quando não dão um caminho explícito. Vazio = usa a pasta de conversas (ou a raiz).")
      .addText((t) => t.setPlaceholder("(usa a pasta de conversas)").setValue(this.plugin.data.agencyFolder)
        .onChange(async (v) => { this.plugin.data.agencyFolder = v.trim(); await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName("Pastas de contexto")
      .setDesc("Uma pasta por linha. Todo agente consulta as notas dessas pastas (até 12 notas, truncadas).")
      .addTextArea((t) => {
        t.setPlaceholder("03. Recursos\n05. Inbox").setValue(data.contextFolders.join("\n"))
          .onChange(async (v) => { data.contextFolders = v.split("\n").map((s) => s.trim()).filter(Boolean); await this.plugin.persist(); });
        t.inputEl.rows = 3;
      });

    new Setting(containerEl)
      .setName("Auto-consultar o cofre")
      .setDesc("Quando não há pastas de contexto, o agente busca as notas mais relevantes à pergunta automaticamente.")
      .addToggle((t) => t.setValue(data.autoConsultVault).onChange(async (v) => { data.autoConsultVault = v; await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName("Roteamento automático (delegação)")
      .setDesc("Antes de responder, encaminha a pergunta para o agente mais adequado do time. Desligue para o agente mencionado sempre responder.")
      .addToggle((t) => t.setValue(data.autoDelegate).onChange(async (v) => { data.autoDelegate = v; await this.plugin.persist(); }));

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

    new Setting(containerEl).setName("Economia de tokens").setHeading();

    new Setting(containerEl)
      .setName("Modo economia")
      .setDesc("Sempre usa contexto enxuto (pula varredura do cofre por chamada). Reduz tokens e rate-limits, com menos contexto.")
      .addToggle((t) => t.setValue(data.economyMode).onChange(async (v) => { data.economyMode = v; await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName("Teto de tokens por resposta")
      .setDesc("Limite de tokens na resposta do modelo (0 = padrão do provider). Ex.: 1024 para respostas curtas e baratas.")
      .addText((t) => t.setPlaceholder("0").setValue(String(data.maxTokens))
        .onChange(async (v) => { data.maxTokens = Math.max(0, Number(v) || 0); await this.plugin.persist(); }));

    new Setting(containerEl)
      .setName("Provider leve (brainstorm/squad/roteamento)")
      .setDesc("Modelo rápido/barato para tarefas multi-chamada. Vazio = usa o provider ativo. Dica: um modelo pequeno (ex.: llama-3.1-8b-instant) evita rate-limit no brainstorm.")
      .addDropdown((d) => {
        d.addOption("", "(usar o ativo)");
        for (const p of data.providers) d.addOption(p.id, p.id);
        d.setValue(data.lightProviderId).onChange(async (v) => { data.lightProviderId = v; await this.plugin.persist(); });
      });

    new Setting(containerEl).setDesc("⚠️ As chaves ficam em data.json dentro do vault. Não inclua esse arquivo em backups públicos.")
      .addButton((b) => b.setButtonText("Recarregar agentes").onClick(async () => { await this.plugin.registry.load(); new Notice("Agentes recarregados"); }));
  }
}

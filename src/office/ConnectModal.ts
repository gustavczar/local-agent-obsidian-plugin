import { App, FuzzySuggestModal } from "obsidian";

export interface ConnectItem { label: string; sublabel: string; linktext: string; }

export class ConnectModal extends FuzzySuggestModal<ConnectItem> {
  constructor(app: App, private items: ConnectItem[], private onPick: (it: ConnectItem) => void) {
    super(app);
    this.setPlaceholder("Conectar a um agente ou nota…");
  }
  getItems(): ConnectItem[] { return this.items; }
  getItemText(it: ConnectItem): string { return `${it.label} ${it.sublabel}`; }
  onChooseItem(it: ConnectItem): void { this.onPick(it); }
}

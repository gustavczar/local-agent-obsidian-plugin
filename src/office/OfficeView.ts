import { ItemView, WorkspaceLeaf } from "obsidian";
import { AgentRegistry } from "../registry/AgentRegistry";
import { Agent } from "../types";
import { Pos } from "./layout";
import { accentOf, avatarGlyph, displayName, roleText } from "./avatar";

export const OFFICE_VIEW = "lao-office-view";

export class OfficeView extends ItemView {
  private workingAgents = new Set<string>();
  private filter = "";
  private showAllConn = false;
  private cardEls = new Map<string, HTMLElement>();
  private floorEl!: HTMLElement;
  private overlay!: SVGSVGElement;

  constructor(
    leaf: WorkspaceLeaf,
    private registry: AgentRegistry,
    private _getPositions: () => Record<string, Pos>,
    private _savePosition: (name: string, pos: Pos) => void,
    private openChat: (agentName: string) => void,
    private onAddAgent: () => void,
  ) {
    super(leaf);
    this.registry.onChange(() => this.render());
  }

  getViewType() { return OFFICE_VIEW; }
  getDisplayText() { return "Agent Office"; }
  getIcon() { return "building-2"; }

  async onOpen() { this.render(); }

  setWorking(agentName: string, working: boolean) {
    if (working) this.workingAgents.add(agentName); else this.workingAgents.delete(agentName);
    const card = this.cardEls.get(agentName);
    if (card) card.toggleClass("working", working);
    const dot = card?.querySelector(".lao-status");
    if (dot) (dot as HTMLElement).toggleClass("working", working);
  }

  private openSettings() {
    const setting = (this.app as any).setting;
    setting?.open?.();
    setting?.openTabById?.("local-agent-office");
  }

  private render() {
    const host = this.contentEl;
    host.empty();
    host.addClass("lao-office-root");
    this.cardEls.clear();

    const agents = this.registry.all();

    // Toolbar
    const bar = host.createDiv({ cls: "lao-toolbar" });
    bar.createSpan({ cls: "lao-brand", text: "Agent Office" });
    const rooms = new Set(agents.map((a) => a.room));
    bar.createSpan({ cls: "lao-count", text: `${agents.length} agentes · ${rooms.size} salas` });

    const spacer = bar.createDiv({ cls: "lao-spacer" });
    spacer.style.flex = "1";

    const search = bar.createEl("input", { cls: "lao-search", attr: { type: "search", placeholder: "Filtrar agentes…" } });
    search.value = this.filter;
    search.addEventListener("input", () => { this.filter = search.value.toLowerCase(); this.applyFilter(); });

    const connBtn = bar.createEl("button", { cls: "lao-conn-btn", text: "Conexões" });
    connBtn.toggleClass("active", this.showAllConn);
    connBtn.addEventListener("click", () => {
      this.showAllConn = !this.showAllConn;
      connBtn.toggleClass("active", this.showAllConn);
      this.clearOverlay();
      if (this.showAllConn) this.drawAllConnections();
    });

    const addBtn = bar.createEl("button", { cls: "lao-add-btn mod-cta", text: "+ Agente" });
    addBtn.addEventListener("click", () => this.onAddAgent());

    const gear = bar.createEl("button", { cls: "lao-gear-btn", attr: { "aria-label": "Configurações" } });
    gear.setText("⚙");
    gear.addEventListener("click", () => this.openSettings());

    // Empty state
    if (!agents.length) {
      const empty = host.createDiv({ cls: "lao-empty" });
      empty.createEl("h3", { text: "Nenhum agente ainda" });
      empty.createEl("p", { text: "Clique em “+ Agente” para criar o primeiro, ou coloque uma nota .md na sua pasta de agentes (⚙ Configurações). Toda nota na pasta vira um agente." });
      const cta = empty.createEl("button", { cls: "mod-cta", text: "+ Criar agente" });
      cta.addEventListener("click", () => this.onAddAgent());
      return;
    }

    this.renderCards(host, agents);
  }

  private renderCards(host: HTMLElement, agents: Agent[]) {
    this.floorEl = host.createDiv({ cls: "lao-floor" });
    this.overlay = this.floorEl.createSvg("svg", { cls: "lao-conn-overlay" });

    const byRoom = new Map<string, Agent[]>();
    for (const a of agents) {
      if (!byRoom.has(a.room)) byRoom.set(a.room, []);
      byRoom.get(a.room)!.push(a);
    }
    for (const room of [...byRoom.keys()].sort((x, y) => x.localeCompare(y))) {
      const panel = this.floorEl.createDiv({ cls: "lao-room-panel" });
      const head = panel.createDiv({ cls: "lao-room-head" });
      head.createSpan({ cls: "lao-room-name", text: `SALA · ${room.toUpperCase()}` });
      head.createSpan({ cls: "lao-room-count", text: String(byRoom.get(room)!.length) });

      const desks = panel.createDiv({ cls: "lao-desks" });
      for (const a of byRoom.get(room)!.sort((p, q) => displayName(p).localeCompare(displayName(q)))) {
        this.renderCard(desks, a);
      }
    }

    if (this.showAllConn) window.requestAnimationFrame(() => this.drawAllConnections());
    this.applyFilter();
  }

  private renderCard(parent: HTMLElement, a: Agent) {
    const card = parent.createDiv({ cls: "lao-card" });
    card.style.setProperty("--accent", accentOf(a));
    card.dataset.agent = a.name;
    if (this.workingAgents.has(a.name)) card.addClass("working");
    this.cardEls.set(a.name, card);

    const avatar = card.createDiv({ cls: "lao-avatar" });
    avatar.setText(avatarGlyph(a));

    const main = card.createDiv({ cls: "lao-card-main" });
    main.createDiv({ cls: "lao-card-name", text: displayName(a) });
    const role = roleText(a);
    if (role) main.createDiv({ cls: "lao-card-role", text: role });
    const meta = main.createDiv({ cls: "lao-card-meta" });
    if (a.connections.length) meta.createSpan({ cls: "lao-card-links", text: `${a.connections.length} conexões` });

    const status = card.createDiv({ cls: "lao-status" });
    if (this.workingAgents.has(a.name)) status.addClass("working");

    card.addEventListener("click", () => this.openChat(a.name));
    card.addEventListener("mouseenter", () => { if (!this.showAllConn) this.highlightConnections(a); });
    card.addEventListener("mouseleave", () => { if (!this.showAllConn) { this.clearOverlay(); this.clearDim(); } });
  }

  private applyFilter() {
    const f = this.filter.trim();
    for (const panel of Array.from(this.floorEl?.querySelectorAll(".lao-room-panel") ?? [])) {
      let visible = 0;
      for (const card of Array.from(panel.querySelectorAll(".lao-card"))) {
        const name = (card as HTMLElement).dataset.agent ?? "";
        const agent = this.registry.get(name);
        const hay = `${name} ${agent?.title ?? ""} ${agent?.room ?? ""}`.toLowerCase();
        const show = !f || hay.includes(f);
        (card as HTMLElement).toggleClass("hidden", !show);
        if (show) visible++;
      }
      (panel as HTMLElement).toggleClass("hidden", visible === 0);
    }
  }

  // ---- connection overlay ----

  private center(el: HTMLElement): { x: number; y: number } {
    const fr = this.floorEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: r.left - fr.left + this.floorEl.scrollLeft + r.width / 2,
      y: r.top - fr.top + this.floorEl.scrollTop + r.height / 2,
    };
  }

  private sizeOverlay() {
    this.overlay.setAttribute("width", String(this.floorEl.scrollWidth));
    this.overlay.setAttribute("height", String(this.floorEl.scrollHeight));
  }

  private clearOverlay() { if (this.overlay) this.overlay.empty(); }
  private clearDim() {
    for (const c of this.cardEls.values()) { c.removeClass("dim"); c.removeClass("linked"); }
  }

  private line(a: { x: number; y: number }, b: { x: number; y: number }, cls: string) {
    this.overlay.createSvg("line", { cls, attr: { x1: a.x, y1: a.y, x2: b.x, y2: b.y } });
  }

  private highlightConnections(agent: Agent) {
    this.sizeOverlay();
    this.clearOverlay();
    const from = this.cardEls.get(agent.name);
    if (!from) return;
    const fc = this.center(from);
    const linked = new Set<string>([agent.name]);
    for (const target of agent.connections) {
      const card = this.cardEls.get(target);
      if (!card) continue;
      linked.add(target);
      this.line(fc, this.center(card), "lao-link active");
    }
    for (const other of this.registry.all()) {
      if (other.connections.includes(agent.name)) {
        const card = this.cardEls.get(other.name);
        if (!card || linked.has(other.name)) continue;
        linked.add(other.name);
        this.line(fc, this.center(card), "lao-link active");
      }
    }
    for (const [name, c] of this.cardEls) {
      if (linked.has(name)) c.addClass("linked"); else c.addClass("dim");
    }
  }

  private drawAllConnections() {
    if (!this.floorEl) return;
    this.sizeOverlay();
    this.clearOverlay();
    for (const a of this.registry.all()) {
      const from = this.cardEls.get(a.name);
      if (!from) continue;
      const fc = this.center(from);
      for (const target of a.connections) {
        const card = this.cardEls.get(target);
        if (!card) continue;
        this.line(fc, this.center(card), "lao-link faint");
      }
    }
  }
}

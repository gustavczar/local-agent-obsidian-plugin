import { ItemView, WorkspaceLeaf, Menu, TFile } from "obsidian";
import { AgentRegistry } from "../registry/AgentRegistry";
import { Agent } from "../types";
import { Pos } from "./layout";
import { accentOf, avatarGlyph, baseName, displayName, roleText } from "./avatar";
import { t as tr } from "../i18n";

export const OFFICE_VIEW = "lao-office-view";

export class OfficeView extends ItemView {
  private workingAgents = new Set<string>();
  private filter = "";
  private showAllConn = false;
  private cardEls = new Map<string, HTMLElement>();
  private targetIndex = new Map<string, string>(); // name/basename/displayName → agent.name
  private floorEl!: HTMLElement;
  private overlay!: SVGSVGElement;

  constructor(
    leaf: WorkspaceLeaf,
    private registry: AgentRegistry,
    private _getPositions: () => Record<string, Pos>,
    private _savePosition: (name: string, pos: Pos) => void,
    private openChat: (agentName: string) => void,
    private onAddAgent: () => void,
    private onConnect: (agentName: string) => void,
  ) {
    super(leaf);
    this.registry.onChange(() => this.render());
  }

  getViewType() { return OFFICE_VIEW; }
  getDisplayText() { return "Agent Office"; }
  getIcon() { return "building-2"; }

  async onOpen() { this.render(); }

  setWorking(agentName: string, working: boolean) {
    this.setActivity(agentName, working ? "working" : "idle");
  }

  /** Drives the visible activity state of an agent card: idle | working | waiting. */
  setActivity(agentName: string, state: "idle" | "working" | "waiting") {
    if (state === "working") this.workingAgents.add(agentName); else this.workingAgents.delete(agentName);
    const card = this.cardEls.get(agentName);
    if (!card) return;
    card.toggleClass("working", state === "working");
    card.toggleClass("waiting", state === "waiting");
    const dot = card.querySelector<HTMLElement>(".lao-status");
    if (dot) { dot.toggleClass("working", state === "working"); dot.toggleClass("waiting", state === "waiting"); }
  }

  /** Briefly animates a delegation line from one agent card to another. */
  flashDelegation(fromName: string, toName: string) {
    if (!this.overlay || !this.floorEl) return;
    const from = this.cardEls.get(fromName);
    const to = this.cardEls.get(toName);
    if (!from || !to) return;
    this.sizeOverlay();
    this.line(this.center(from), this.center(to), "lao-link delegate");
    window.setTimeout(() => this.clearOverlay(), 3000);
  }

  private openSettings() {
    const setting = (this.app as unknown as {
      setting?: { open(): void; openTabById(id: string): void };
    }).setting;
    setting?.open();
    setting?.openTabById("local-agent-office");
  }

  /** Right-click on a card: quick actions (chat, open agent note, connect, settings). */
  private showCardMenu(e: MouseEvent, a: Agent) {
    e.preventDefault();
    const menu = new Menu();
    menu.addItem((it) => it.setTitle(tr("office.menu.chat")).setIcon("message-square").onClick(() => this.openChat(a.name)));
    menu.addItem((it) => it.setTitle(tr("office.menu.openNote")).setIcon("file-text").onClick(() => {
      const f = this.app.vault.getAbstractFileByPath(a.filePath);
      if (f instanceof TFile) void this.app.workspace.getLeaf(true).openFile(f);
    }));
    menu.addItem((it) => it.setTitle(tr("office.menu.connect")).setIcon("link").onClick(() => this.onConnect(a.name)));
    menu.addItem((it) => it.setTitle(tr("office.settings")).setIcon("settings").onClick(() => this.openSettings()));
    menu.showAtMouseEvent(e);
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
    bar.createSpan({ cls: "lao-count", text: tr("office.count", { agents: agents.length, rooms: rooms.size }) });

    bar.createDiv({ cls: "lao-spacer" });

    const search = bar.createEl("input", { cls: "lao-search", attr: { type: "search", placeholder: tr("office.search") } });
    search.value = this.filter;
    search.addEventListener("input", () => { this.filter = search.value.toLowerCase(); this.applyFilter(); });

    const connBtn = bar.createEl("button", { cls: "lao-conn-btn", text: tr("office.connections") });
    connBtn.toggleClass("active", this.showAllConn);
    connBtn.addEventListener("click", () => {
      this.showAllConn = !this.showAllConn;
      connBtn.toggleClass("active", this.showAllConn);
      this.clearOverlay();
      if (this.showAllConn) this.drawAllConnections();
    });

    const addBtn = bar.createEl("button", { cls: "lao-add-btn mod-cta", text: tr("office.addAgent") });
    addBtn.addEventListener("click", () => this.onAddAgent());

    const gear = bar.createEl("button", { cls: "lao-gear-btn", attr: { "aria-label": tr("office.settings") } });
    gear.setText("⚙");
    gear.addEventListener("click", () => this.openSettings());

    // Empty state
    if (!agents.length) {
      const empty = host.createDiv({ cls: "lao-empty" });
      empty.createEl("h3", { text: tr("office.empty.title") });
      empty.createEl("p", { text: tr("office.empty.desc") });
      const cta = empty.createEl("button", { cls: "mod-cta", text: tr("office.createFirst") });
      cta.addEventListener("click", () => this.onAddAgent());
      return;
    }

    this.renderCards(host, agents);
  }

  private resolveAgentName(target: string): string | undefined {
    return this.targetIndex.get(target.trim().toLowerCase());
  }

  private renderCards(host: HTMLElement, agents: Agent[]) {
    this.floorEl = host.createDiv({ cls: "lao-floor" });
    this.overlay = this.floorEl.createSvg("svg", { cls: "lao-conn-overlay" });

    this.targetIndex.clear();
    for (const a of agents) {
      this.targetIndex.set(a.name.toLowerCase(), a.name);
      this.targetIndex.set(baseName(a.filePath).toLowerCase(), a.name);
      this.targetIndex.set(displayName(a).toLowerCase(), a.name);
    }

    const byRoom = new Map<string, Agent[]>();
    for (const a of agents) {
      if (!byRoom.has(a.room)) byRoom.set(a.room, []);
      byRoom.get(a.room)!.push(a);
    }
    for (const room of [...byRoom.keys()].sort((x, y) => x.localeCompare(y))) {
      const panel = this.floorEl.createDiv({ cls: "lao-room-panel" });
      const head = panel.createDiv({ cls: "lao-room-head" });
      head.createSpan({ cls: "lao-room-name", text: tr("office.room", { name: room.toUpperCase() }) });
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
    if (a.connections.length) meta.createSpan({ cls: "lao-card-links", text: tr("office.connCount", { n: a.connections.length }) });

    const status = card.createDiv({ cls: "lao-status" });
    if (this.workingAgents.has(a.name)) status.addClass("working");

    const actions = card.createDiv({ cls: "lao-card-actions" });
    const connectBtn = actions.createEl("button", { cls: "lao-card-act", text: "🔗", attr: { title: tr("office.cardConnect") } });
    connectBtn.addEventListener("click", (e) => { e.stopPropagation(); this.onConnect(a.name); });

    card.addEventListener("click", () => this.openChat(a.name));
    card.addEventListener("contextmenu", (e) => this.showCardMenu(e, a));
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
    // NB: set the class via the `class` attribute, not `cls` — multi-class strings ("lao-link active")
    // go through classList.add() for SVG and throw InvalidCharacterError on the space.
    this.overlay.createSvg("line", { attr: { class: cls, x1: a.x, y1: a.y, x2: b.x, y2: b.y } });
  }

  private highlightConnections(agent: Agent) {
    this.sizeOverlay();
    this.clearOverlay();
    const from = this.cardEls.get(agent.name);
    if (!from) return;
    const fc = this.center(from);
    const linked = new Set<string>([agent.name]);
    for (const target of agent.connections) {
      const tname = this.resolveAgentName(target);
      const card = tname ? this.cardEls.get(tname) : undefined;
      if (!card || !tname) continue;
      linked.add(tname);
      this.line(fc, this.center(card), "lao-link active");
    }
    for (const other of this.registry.all()) {
      if (other.connections.some((t) => this.resolveAgentName(t) === agent.name)) {
        const card = this.cardEls.get(other.name);
        if (!card || linked.has(other.name)) continue;
        linked.add(other.name);
        this.line(fc, this.center(card), "lao-link active");
      }
    }
    for (const [name, c] of this.cardEls) {
      if (name === agent.name) continue; // hovered card stays full
      c.addClass("dim");
      if (linked.has(name)) c.addClass("linked");
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
        const tname = this.resolveAgentName(target);
        const card = tname ? this.cardEls.get(tname) : undefined;
        if (!card) continue;
        this.line(fc, this.center(card), "lao-link faint");
      }
    }
  }
}

import { ItemView, WorkspaceLeaf } from "obsidian";
import { AgentRegistry } from "../registry/AgentRegistry";
import { computeLayout, Pos } from "./layout";

export const OFFICE_VIEW = "lao-office-view";
const SVGNS = "http://www.w3.org/2000/svg";

export class OfficeView extends ItemView {
  private workingAgents = new Set<string>();

  constructor(
    leaf: WorkspaceLeaf,
    private registry: AgentRegistry,
    private getPositions: () => Record<string, Pos>,
    private savePosition: (name: string, pos: Pos) => void,
    private openChat: (agentName: string) => void,
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
    this.render();
  }

  private render() {
    const host = this.contentEl;
    host.empty();
    const w = host.clientWidth || 800;
    const h = host.clientHeight || 600;
    const layout = computeLayout(this.registry.all(), this.getPositions(), { w, h });

    const svg = host.createSvg("svg", { cls: "lao-office", attr: { viewBox: `0 0 ${w} ${h}` } });

    for (const r of layout.rooms) {
      svg.createSvg("rect", { cls: "lao-room", attr: { x: r.x, y: r.y, width: r.w, height: r.h, rx: 6 } });
      svg.createSvg("text", { cls: "lao-room-label", attr: { x: r.x + 8, y: r.y + 16 }, text: `SALA · ${r.name.toUpperCase()}` });
    }

    const byName = new Map(layout.nodes.map((n) => [n.name, n]));
    for (const a of this.registry.all()) {
      const from = byName.get(a.name)!;
      for (const target of a.connections) {
        const to = byName.get(target);
        if (!to) continue;
        svg.createSvg("line", { cls: "lao-link", attr: { x1: from.x, y1: from.y, x2: to.x, y2: to.y } });
      }
    }

    for (const n of layout.nodes) {
      const cls = this.workingAgents.has(n.name) ? "lao-node working" : "lao-node idle";
      const dot = svg.createSvg("circle", { cls, attr: { cx: n.x, cy: n.y, r: 9 } });
      svg.createSvg("text", { cls: "lao-node-label", attr: { x: n.x, y: n.y + 24, "text-anchor": "middle" }, text: n.title.split("—")[0].trim() });
      this.attachDrag(dot, n.name, svg);
      dot.addEventListener("click", () => this.openChat(n.name));
    }
  }

  private attachDrag(dot: SVGElement, name: string, svg: SVGSVGElement) {
    let dragging = false;
    dot.addEventListener("mousedown", () => (dragging = true));
    svg.addEventListener("mousemove", (e: MouseEvent) => {
      if (!dragging) return;
      const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      dot.setAttribute("cx", String(loc.x)); dot.setAttribute("cy", String(loc.y));
    });
    svg.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      this.savePosition(name, { x: Number(dot.getAttribute("cx")), y: Number(dot.getAttribute("cy")) });
    });
  }
}

import { Agent } from "../types";
import { accentOf, avatarGlyph, displayName } from "./avatar";

const WANDER_MS = 2600; // how often an idle token drifts to a new spot
const TOKEN = 46;       // token footprint (px)

interface Token { el: HTMLElement; area: HTMLElement; }

/**
 * The "living office": agent avatars wander slowly inside their room and walk
 * to the room's meeting spot when you open their chat. Pure DOM + CSS
 * transitions — no animation engine.
 */
export class LiveMap {
  private timer: number | null = null;
  private tokens = new Map<string, Token>();
  private chatting: string | null = null;

  constructor(
    private host: HTMLElement,
    private agents: Agent[],
    private working: Set<string>,
    private openChat: (name: string) => void,
  ) {}

  mount() {
    this.host.empty();
    const floor = this.host.createDiv({ cls: "lao-map" });

    const byRoom = new Map<string, Agent[]>();
    for (const a of this.agents) {
      if (!byRoom.has(a.room)) byRoom.set(a.room, []);
      byRoom.get(a.room)!.push(a);
    }
    for (const room of [...byRoom.keys()].sort((x, y) => x.localeCompare(y))) {
      const panel = floor.createDiv({ cls: "lao-map-room" });
      const head = panel.createDiv({ cls: "lao-map-room-head" });
      head.createSpan({ cls: "lao-map-room-name", text: `SALA · ${room.toUpperCase()}` });
      head.createSpan({ cls: "lao-map-room-count", text: String(byRoom.get(room)!.length) });
      const area = panel.createDiv({ cls: "lao-map-area" });
      for (const a of byRoom.get(room)!) this.makeToken(area, a);
    }

    // place + start once the DOM has dimensions
    window.requestAnimationFrame(() => { this.tick(); this.start(); });
  }

  private makeToken(area: HTMLElement, a: Agent) {
    const el = area.createDiv({ cls: "lao-token" });
    el.style.setProperty("--accent", accentOf(a));
    el.setAttr("data-agent", a.name);
    const av = el.createDiv({ cls: "lao-token-av" });
    av.setText(avatarGlyph(a));
    av.createDiv({ cls: "lao-token-bubble", text: "•••" });
    el.createDiv({ cls: "lao-token-name", text: displayName(a) });
    if (this.working.has(a.name)) el.addClass("thinking");
    el.addEventListener("click", () => { this.setChatting(a.name); this.openChat(a.name); });
    this.tokens.set(a.name, { el, area });
  }

  private randomPoint(area: HTMLElement) {
    const w = area.clientWidth || 240, h = area.clientHeight || 150;
    return {
      x: 8 + Math.random() * Math.max(1, w - TOKEN - 16),
      y: 6 + Math.random() * Math.max(1, h - TOKEN - 22),
    };
  }
  private meetingPoint(area: HTMLElement) {
    const w = area.clientWidth || 240, h = area.clientHeight || 150;
    return { x: (w - TOKEN) / 2, y: Math.max(6, h - TOKEN - 14) };
  }
  private move(name: string, p: { x: number; y: number }) {
    const t = this.tokens.get(name);
    if (t) t.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  private start() {
    if (this.timer != null) return;
    this.timer = window.setInterval(() => this.tick(), WANDER_MS);
  }
  private tick() {
    for (const [name, t] of this.tokens) {
      if (name === this.chatting) { this.move(name, this.meetingPoint(t.area)); continue; }
      this.move(name, this.randomPoint(t.area));
    }
  }

  setWorking(name: string, working: boolean) {
    this.tokens.get(name)?.el.toggleClass("thinking", working);
  }

  setChatting(name: string | null) {
    if (this.chatting && this.chatting !== name) this.tokens.get(this.chatting)?.el.removeClass("chatting");
    this.chatting = name;
    if (name) {
      const t = this.tokens.get(name);
      if (t) { t.el.addClass("chatting"); this.move(name, this.meetingPoint(t.area)); }
    }
  }

  destroy() {
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = null;
    this.tokens.clear();
  }
}

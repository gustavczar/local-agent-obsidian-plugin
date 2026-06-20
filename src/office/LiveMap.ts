import { Agent } from "../types";
import { accentOf, avatarGlyph, displayName } from "./avatar";

interface Token { el: HTMLElement; }

/**
 * The "living office": agents stand as 2D characters in their rooms. They are
 * stationary (gentle idle breathing) and react when acted on — stepping forward
 * with a thinking bubble + glow while generating. Pure DOM + CSS.
 */
export class LiveMap {
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
      for (const a of byRoom.get(room)!.sort((p, q) => displayName(p).localeCompare(displayName(q)))) {
        this.makeChar(area, a);
      }
    }
  }

  private makeChar(area: HTMLElement, a: Agent) {
    const el = area.createDiv({ cls: "lao-token" });
    el.style.setProperty("--accent", accentOf(a));
    el.setAttr("data-agent", a.name);
    el.style.setProperty("--bob-delay", `${(Math.random() * 1.8).toFixed(2)}s`);
    if (this.working.has(a.name)) el.addClass("thinking");

    const char = el.createDiv({ cls: "lao-char" });
    const bubble = char.createDiv({ cls: "lao-token-bubble", text: "•••" });
    const head = char.createDiv({ cls: "lao-char-head" });
    head.setText(avatarGlyph(a));
    char.createDiv({ cls: "lao-char-body" });
    el.createDiv({ cls: "lao-token-shadow" });
    el.createDiv({ cls: "lao-token-name", text: displayName(a) });

    el.addEventListener("click", () => { this.setChatting(a.name); this.openChat(a.name); });
    this.tokens.set(a.name, { el });
  }

  setWorking(name: string, working: boolean) {
    this.tokens.get(name)?.el.toggleClass("thinking", working);
  }

  setChatting(name: string | null) {
    if (this.chatting && this.chatting !== name) this.tokens.get(this.chatting)?.el.removeClass("active");
    this.chatting = name;
    if (name) this.tokens.get(name)?.el.addClass("active");
  }

  destroy() { this.tokens.clear(); }
}

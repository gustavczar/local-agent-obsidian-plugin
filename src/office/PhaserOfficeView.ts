import { ItemView, WorkspaceLeaf } from "obsidian";
import Phaser from "phaser";
import { AgentRegistry } from "../registry/AgentRegistry";
import type { PhaserAgent, SquadState } from "../types";
import { Actor, Station } from "./AgentSprite";
import { HandoffChoreography } from "./HandoffChoreography";
import { AmbientDirector } from "./AmbientDirector";
import { RoomBuilder, type OfficePoints } from "./RoomBuilder";
import { computeOfficeLayout } from "./deskLayout";
import { CHARACTER_NAMES, DESK_KEYS, FURNITURE_KEYS, assignCharacters, avatarKeys } from "./officeAssets";

export const PHASER_OFFICE_VIEW = "lao-phaser-office-view";

class OfficeScene extends Phaser.Scene {
  private stations = new Map<string, Station>();
  private actors = new Map<string, Actor>();
  private roomBuilder!: RoomBuilder;
  private choreography!: HandoffChoreography;
  private ambient!: AmbientDirector;
  private points: OfficePoints | null = null;
  private aisleY = 0;

  private pending: SquadState | null = null;
  private current: SquadState | null = null;
  private ready = false;

  constructor(
    private assetsBase: string,
    private onAgentClick: (agent: PhaserAgent) => void,
  ) {
    super({ key: "OfficeScene" });
  }

  preload() {
    // Obsidian serves the plugin folder over app://, so relative paths never resolve —
    // every load below is relative to this base.
    this.load.setBaseURL(this.assetsBase);
    // Texture key IS the path: every consumer references DESK_KEYS.x / FURNITURE_KEYS.x,
    // which hold paths, so registering under the object key would never be found.
    for (const path of Object.values(DESK_KEYS)) this.load.image(path, path);
    for (const name of CHARACTER_NAMES) {
      const keys = avatarKeys(name);
      this.load.image(keys.blink, keys.blink);
      this.load.image(keys.talk, keys.talk);
    }
    for (const path of Object.values(FURNITURE_KEYS)) this.load.image(path, path);
    this.load.on("loaderror", (file: Phaser.Loader.File) =>
      console.error("Failed to load asset:", file.key, file.url));
  }

  create() {
    for (const tex of Object.values(this.textures.list)) {
      if (tex.key !== "__DEFAULT" && tex.key !== "__MISSING") {
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }

    this.roomBuilder = new RoomBuilder(this);
    this.choreography = new HandoffChoreography({
      getActor: (id) => this.actors.get(id),
      getStation: (id) => this.stations.get(id),
      wait: (ms) => new Promise((r) => this.time.delayedCall(ms, r)),
      onFocus: (a, b) => this.focusOn(a, b),
      onFocusEnd: () => this.frameRoom(),
    });

    this.ambient = new AmbientDirector({
      getActors: () => [...this.actors.values()],
      getPoints: () => this.points,
      getAisleY: () => this.aisleY,
      schedule: (ms, cb) => {
        const ev = this.time.delayedCall(ms, cb);
        return () => ev.remove();
      },
      wait: (ms) => new Promise((r) => this.time.delayedCall(ms, r)),
      random: () => Math.random(),
    });
    this.ambient.start();

    this.ready = true;
    if (this.pending) { const p = this.pending; this.pending = null; this.applyState(p); }
  }

  applyState(next: SquadState) {
    if (!this.ready) { this.pending = next; return; }

    if (this.castChanged(next)) {
      this.rebuild(next);
    } else {
      for (const agent of next.agents) this.actors.get(agent.id)?.setStatus(agent);
      this.syncScreens(next);
    }
    this.current = next;
    // Anyone who started working while off wandering gets pulled back to their desk.
    this.ambient.syncWithState();

    if (next.handoff && !this.choreography.hasPlayed(next.handoff)) {
      void this.choreography.play(next.handoff);
    }
  }

  // Only a different cast or a different grid justifies destroying sprites; a status
  // change must not, or an agent mid-walk would be recreated at its desk every tick.
  private castChanged(next: SquadState): boolean {
    if (!this.current) return true;
    const a = this.current.agents, b = next.agents;
    if (a.length !== b.length) return true;
    return a.some((x, i) =>
      x.id !== b[i].id || x.desk.col !== b[i].desk.col || x.desk.row !== b[i].desk.row);
  }

  private rebuild(next: SquadState) {
    this.choreography.reset();
    this.clearScene();

    const layout = computeOfficeLayout(next.agents);
    this.points = this.roomBuilder.build(layout.roomW, layout.roomH);
    this.aisleY = layout.aisleY;

    const characters = assignCharacters(next.agents);
    layout.placements.forEach((slot, i) => {
      const agent = next.agents[i];
      const variant = i % 2 === 0 ? "black" : "white";
      this.stations.set(agent.id, new Station(this, slot.x, slot.y, variant));
      this.actors.set(agent.id, new Actor(
        this, { x: slot.x, y: slot.y }, characters.get(agent.id)!, agent,
        (a) => this.onAgentClick(a),
      ));
    });

    this.syncScreens(next);
    this.frameRoom(layout.roomW, layout.roomH);
  }

  private syncScreens(state: SquadState) {
    for (const agent of state.agents) {
      this.stations.get(agent.id)?.setScreenOn(agent.status === "working");
    }
  }

  // --- camera ---

  private roomW = 0;
  private roomH = 0;

  private frameRoom(roomW = this.roomW, roomH = this.roomH) {
    this.roomW = roomW; this.roomH = roomH;
    if (!roomW || !roomH) return;
    const cam = this.cameras.main;
    const zoom = Math.min(cam.width / (roomW + 32), cam.height / (roomH + 32), 2);
    cam.zoomTo(zoom, 400, "Sine.easeInOut");
    cam.pan(roomW / 2, roomH / 2, 400, "Sine.easeInOut");
  }

  // A delivery in a big office is unreadable at fit-the-whole-room zoom, so lean in
  // on the stretch between the two desks while it plays.
  private focusOn(a: { x: number; y: number }, b: { x: number; y: number }) {
    const cam = this.cameras.main;
    const spanW = Math.abs(a.x - b.x) + 420;
    const spanH = Math.abs(a.y - b.y) + 420;
    const fit = Math.min(cam.width / spanW, cam.height / spanH, 2);
    const roomFit = this.roomW ? Math.min(cam.width / (this.roomW + 32), cam.height / (this.roomH + 32), 2) : fit;
    cam.zoomTo(Math.max(fit, roomFit), 500, "Sine.easeInOut");
    cam.pan((a.x + b.x) / 2, (a.y + b.y) / 2, 500, "Sine.easeInOut");
  }

  resizeCamera() { this.frameRoom(); }

  shutdownScene() {
    this.ambient?.stop();
    this.choreography?.cancel();
  }

  private clearScene() {
    for (const a of this.actors.values()) a.destroy();
    for (const s of this.stations.values()) s.destroy();
    this.actors.clear(); this.stations.clear();
    this.children.removeAll(true);
  }
}

export class PhaserOfficeView extends ItemView {
  private game: Phaser.Game | null = null;
  private scene: OfficeScene | null = null;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;

  /** Set by the plugin so a closed view stops being notified of state changes. */
  onDispose: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private registry: AgentRegistry,
    private getSquadState: () => SquadState | null,
    private pluginDir: string,
    private onAgentClick: (agentName: string) => void,
  ) {
    super(leaf);
    this.registry.onChange(() => this.updateAgents());
  }

  // app:// URL for the plugin's bundled assets; getResourcePath appends a ?mtime we must
  // drop because Phaser concatenates file paths onto this base.
  private assetsBase(): string {
    return this.app.vault.adapter.getResourcePath(`${this.pluginDir}/assets`).split("?")[0] + "/";
  }

  getViewType() { return PHASER_OFFICE_VIEW; }
  getDisplayText() { return "Agent Office (Phaser)"; }
  getIcon() { return "layout"; }

  async onOpen() {
    const container = this.contentEl.createDiv({ cls: "lao-phaser-container" });
    container.style.width = "100%";
    container.style.height = "100%";

    this.scene = new OfficeScene(this.assetsBase(), (a) => this.onAgentClick(a.name));

    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      width: container.clientWidth || 800,
      height: container.clientHeight || 600,
      pixelArt: false,
      backgroundColor: "#1a1420",
      scene: [this.scene],
      scale: { mode: Phaser.Scale.NONE },
    });

    this.game.events.once("ready", () => this.updateAgents());

    this.ro = new ResizeObserver(() => {
      if (this.game && container.clientWidth > 0 && container.clientHeight > 0) {
        this.game.scale.resize(container.clientWidth, container.clientHeight);
        this.scene?.resizeCamera();
      }
    });
    this.ro.observe(container);

    // Ambient life animates forever. Left running behind another tab it would burn CPU
    // all day for pixels nobody is looking at.
    this.io = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (!this.game) return;
      if (visible) this.game.loop.wake();
      else this.game.loop.sleep();
    });
    this.io.observe(container);
  }

  updateAgents() {
    const state = this.getSquadState();
    if (state) this.scene?.applyState(state);
  }

  async onClose() {
    this.onDispose?.();
    this.onDispose = null;
    this.scene?.shutdownScene();
    this.io?.disconnect();
    this.io = null;
    this.ro?.disconnect();
    this.ro = null;
    this.game?.destroy(true);
    this.game = null;
    this.scene = null;
  }
}

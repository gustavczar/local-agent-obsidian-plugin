import Phaser from "phaser";
import type { PhaserAgent, PhaserAgentStatus } from "../types";
import {
  AVATAR_SCALE, COLORS, DESK_KEYS, FURNITURE_KEYS,
  STATUS_COLORS, STATUS_LABELS, avatarKeys, statusHexColor,
} from "./officeAssets";

// The old AgentSprite bundled desk and avatar into one object, so moving an agent
// would have dragged its desk along. Station is what stays put; Actor is what walks.

const SEAT_DY = -70;          // avatar sits this far above the desk anchor
const VISIT_DX = -66;         // a visitor stands to the left, clear of the coffee mug
const VISIT_DY = 12;          // and slightly downstage, so it draws in front of the desk
const BADGE_DY = -140;

/** Who currently owns an actor's movement. */
export type ActorActivity = "seated" | "ambient" | "handoff";

/** Desk, monitor, mug, shadow. Fixed in place for the lifetime of a render. */
export class Station {
  readonly x: number;
  readonly y: number;
  private deskTable: Phaser.GameObjects.Image;
  private monitor: Phaser.GameObjects.Image;
  private coffeeMug: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Graphics;
  private glowTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, variant: "black" | "white") {
    this.x = x; this.y = y;

    this.shadow = scene.add.graphics().setDepth(y - 1);
    this.shadow.fillStyle(0x000000, 0.18);
    this.shadow.fillEllipse(x, y + 18, 120, 22);

    // The screen faces the agent, so its light falls on them rather than on us.
    // Drawn between avatar and desk: over the agent, under the monitor.
    this.glow = scene.add.graphics().setDepth(y + 0.5);
    this.glow.fillStyle(COLORS.screenGlow, 1);
    this.glow.fillEllipse(x, y - 46, 74, 34);
    this.glow.setBlendMode(Phaser.BlendModes.ADD);
    this.glow.setAlpha(0);

    this.deskTable = scene.add.image(x, y, FURNITURE_KEYS.deskWood)
      .setOrigin(0.5, 0.5).setScale(1.3).setDepth(y + 1);

    const monitorKey = variant === "black" ? DESK_KEYS.blackFacingAgent : DESK_KEYS.whiteFacingAgent;
    this.monitor = scene.add.image(x, y - 30, monitorKey)
      .setOrigin(0.5, 0.5).setScale(1.3).setDepth(y + 2);

    this.coffeeMug = scene.add.image(x + 42, y + 8, FURNITURE_KEYS.coffeeMug)
      .setOrigin(0.5, 1).setScale(1.4).setDepth(y + 3);

    this.glowTween = scene.tweens.add({
      targets: this.glow, alpha: { from: 0.10, to: 0.26 },
      duration: 1400, yoyo: true, repeat: -1, paused: true,
    });
  }

  get seatPosition() { return { x: this.x, y: this.y }; }
  get visitPosition() { return { x: this.x + VISIT_DX, y: this.y + VISIT_DY }; }

  setScreenOn(on: boolean) {
    if (on) {
      this.glow.setAlpha(0.10);
      this.glowTween?.play();
    } else {
      this.glowTween?.pause();
      this.glow.setAlpha(0);
    }
  }

  destroy() {
    this.glowTween?.remove();
    this.shadow.destroy(); this.glow.destroy();
    this.deskTable.destroy(); this.monitor.destroy(); this.coffeeMug.destroy();
  }
}

/** Avatar plus name badge. Moves as a unit; this is the thing that walks. */
export class Actor {
  private scene: Phaser.Scene;
  private body: Phaser.GameObjects.Container;
  private label: Phaser.GameObjects.Container;
  private avatar: Phaser.GameObjects.Image;
  private badgeBg: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private statusDot: Phaser.GameObjects.Graphics;
  private bubble?: Phaser.GameObjects.Container;

  private animTimer?: Phaser.Time.TimerEvent;
  private moveTween?: Phaser.Tweens.Tween;
  private bobTween?: Phaser.Tweens.Tween;
  private breathTween?: Phaser.Tweens.Tween;
  private settleMove?: () => void;
  private pathToken = 0;
  private avatarDisplayH = 0;

  readonly seat: { x: number; y: number };
  private agent: PhaserAgent;
  private characterName: string;

  // Who owns this actor's movement right now. The choreography always outranks the
  // ambient director, which may only touch actors that are "seated".
  private currentActivity: ActorActivity = "seated";

  constructor(
    scene: Phaser.Scene,
    seat: { x: number; y: number },
    characterName: string,
    agent: PhaserAgent,
    onClick?: (agent: PhaserAgent) => void,
  ) {
    this.scene = scene; this.seat = { ...seat }; this.agent = agent; this.characterName = characterName;

    this.avatar = scene.add.image(0, SEAT_DY, avatarKeys(characterName).talk)
      .setOrigin(0.5, 0.5).setScale(AVATAR_SCALE);
    this.avatarDisplayH = this.avatar.displayHeight;

    this.body = scene.add.container(seat.x, seat.y, [this.avatar]).setDepth(seat.y);

    // The badge lives outside the body container so it can keep a high depth and stay
    // legible over furniture, while still travelling with the actor.
    this.badgeBg = scene.add.graphics();
    this.nameText = scene.add.text(0, BADGE_DY + 5, agent.name, {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontSize: "16px", fontStyle: "bold", color: "#ffffff",
      align: "center", stroke: "#000000", strokeThickness: 4, resolution: 2,
    }).setOrigin(0.5, 0);
    this.statusText = scene.add.text(0, BADGE_DY + 24, STATUS_LABELS[agent.status], {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontSize: "13px", fontStyle: "bold", color: statusHexColor(agent.status),
      align: "center", stroke: "#000000", strokeThickness: 3, resolution: 2,
    }).setOrigin(0.5, 0);
    this.statusDot = scene.add.graphics();

    this.label = scene.add
      .container(seat.x, seat.y, [this.badgeBg, this.nameText, this.statusText, this.statusDot])
      .setDepth(901);

    this.redrawBadge();
    this.startBlinking();
    this.startBreathing();

    if (onClick) {
      this.avatar.setInteractive({ useHandCursor: true });
      this.avatar.on("pointerdown", () => onClick(this.agent));
    }
  }

  get id() { return this.agent.id; }
  get position() { return { x: this.body.x, y: this.body.y }; }
  get data() { return this.agent; }

  setPosition(x: number, y: number) {
    this.body.setPosition(x, y).setDepth(y);
    this.label.setPosition(x, y);
    this.bubble?.setPosition(x, y);
  }

  /**
   * Walks to a point. Always settles: arriving resolves, and so does being cancelled.
   * Phaser's tween.remove() skips onComplete, so without holding the resolver a
   * cancelled walk would leave its caller awaiting a promise that never settles.
   */
  walkTo(x: number, y: number): Promise<void> {
    this.cancelTween();
    const distance = Math.hypot(x - this.body.x, y - this.body.y);
    if (distance < 1) return Promise.resolve();

    // Constant speed, so a long walk across a big office does not finish suspiciously fast.
    const duration = Math.min(2400, Math.max(320, (distance / 140) * 1000));

    this.startWalkBob();
    return new Promise<void>((resolve) => {
      this.settleMove = resolve;
      this.moveTween = this.scene.tweens.add({
        targets: this.body, x, y, duration, ease: "Sine.easeInOut",
        onUpdate: () => {
          this.body.setDepth(this.body.y);
          this.label.setPosition(this.body.x, this.body.y);
          this.bubble?.setPosition(this.body.x, this.body.y);
        },
        onComplete: () => this.finishMove(),
      });
    });
  }

  /** Walks a series of waypoints. Stops early if any leg is cancelled. */
  async walkPath(points: { x: number; y: number }[]): Promise<void> {
    for (const p of points) {
      const token = ++this.pathToken;
      await this.walkTo(p.x, p.y);
      if (token !== this.pathToken) return;   // cancelled or superseded mid-path
    }
  }

  returnToSeat(): Promise<void> {
    return this.walkTo(this.seat.x, this.seat.y);
  }

  /** Aborts the whole journey — including remaining waypoints — where the actor stands. */
  stopMoving() {
    this.pathToken++;      // invalidates any walkPath still awaiting a leg
    this.cancelTween();
  }

  // Ends the current leg only. walkPath uses this between waypoints, so it must not
  // touch pathToken or the path would abort itself after its first step.
  private cancelTween() {
    this.moveTween?.remove();
    this.finishMove();
  }

  private finishMove() {
    this.moveTween = undefined;
    this.stopWalkBob();
    const settle = this.settleMove;
    this.settleMove = undefined;
    settle?.();
  }

  // --- activity ownership ---

  get activity(): ActorActivity { return this.currentActivity; }

  /** Takes ownership of movement. Ambient loses to handoff; handoff takes it regardless. */
  claim(activity: Exclude<ActorActivity, "seated">): boolean {
    if (activity === "ambient" && this.currentActivity !== "seated") return false;
    this.currentActivity = activity;
    return true;
  }

  release() {
    this.currentActivity = "seated";
  }

  /** Cancels whatever the actor was doing and drops its bubble, without moving it home. */
  abort() {
    this.stopMoving();
    this.hideBubble();
    this.release();
  }

  say(text: string) {
    this.hideBubble();
    if (!text) return;

    const label = this.scene.add.text(0, 0, text, {
      fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
      fontSize: "13px", color: "#f3efff", align: "center",
      wordWrap: { width: 220 }, resolution: 2,
    }).setOrigin(0.5, 0.5);

    const w = label.width + 22, h = label.height + 16;
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x241c33, 0.97); bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.lineStyle(1, 0x8a76a8, 0.6); bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.fillStyle(0x241c33, 0.97);
    bg.fillTriangle(-7, h / 2 - 1, 7, h / 2 - 1, 0, h / 2 + 9);

    this.bubble = this.scene.add
      .container(this.body.x, this.body.y, [bg, label])
      .setDepth(950);
    this.bubble.setY(this.body.y);
    bg.setY(BADGE_DY - 44 - h / 2); label.setY(BADGE_DY - 44 - h / 2);
  }

  hideBubble() {
    this.bubble?.destroy(true);
    this.bubble = undefined;
  }

  setStatus(agent: PhaserAgent) {
    const changed = this.agent.status !== agent.status || this.agent.name !== agent.name;
    this.agent = agent;
    if (!changed) return;

    this.nameText.setText(agent.name);
    this.statusText.setText(STATUS_LABELS[agent.status]);
    this.statusText.setColor(statusHexColor(agent.status));
    this.redrawBadge();
    this.startBreathing();
  }

  get status(): PhaserAgentStatus { return this.agent.status; }

  destroy() {
    this.stopMoving();
    this.breathTween?.remove();
    this.animTimer?.destroy();
    this.hideBubble();
    this.label.destroy(true);
    this.body.destroy(true);
  }

  // --- internals ---

  private redrawBadge() {
    const bgW = Math.max(this.nameText.width, this.statusText.width + 18) + 20;
    const bgH = 44;
    this.badgeBg.clear();
    this.badgeBg.fillStyle(0x1a1225, 0.95);
    this.badgeBg.fillRoundedRect(-bgW / 2, BADGE_DY, bgW, bgH, 5);
    this.badgeBg.lineStyle(1, 0x6a5a80, 0.4);
    this.badgeBg.strokeRoundedRect(-bgW / 2, BADGE_DY, bgW, bgH, 4);

    this.statusDot.clear();
    this.statusDot.fillStyle(STATUS_COLORS[this.agent.status] ?? COLORS.statusIdle, 1);
    const textW = Math.max(this.statusText.width, 24);
    this.statusDot.fillCircle(-textW / 2 - 5, this.statusText.y + this.statusText.height / 2, 3);
  }

  private startBlinking() {
    const keys = avatarKeys(this.characterName);
    let frame = 0;
    this.animTimer = this.scene.time.addEvent({
      delay: 500, loop: true,
      callback: () => {
        frame = (frame + 1) % 2;
        this.avatar.setTexture(frame === 0 ? keys.talk : keys.blink);
        this.avatar.setScale(this.avatarDisplayH / this.avatar.height);
      },
    });
  }

  // Constant, tiny. Without it a room where nothing is happening reads as a screenshot.
  // Someone working breathes shallower and faster — it reads as typing, not idling.
  private startBreathing() {
    this.breathTween?.remove();
    const working = this.agent.status === "working";
    this.breathTween = this.scene.tweens.add({
      targets: this.avatar,
      y: SEAT_DY - (working ? 1.2 : 2.5),
      duration: working ? 900 : 2400,
      yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });
  }

  private startWalkBob() {
    this.stopWalkBob();
    this.breathTween?.pause();
    this.bobTween = this.scene.tweens.add({
      targets: this.avatar, y: SEAT_DY - 6,
      duration: 220, yoyo: true, repeat: -1, ease: "Sine.easeInOut",
    });
  }

  private stopWalkBob() {
    this.bobTween?.remove();
    this.bobTween = undefined;
    this.avatar.setY(SEAT_DY);
    this.breathTween?.resume();
  }
}
